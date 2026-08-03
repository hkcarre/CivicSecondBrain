/**
 * POST /api/chat
 *
 * Streaming chat endpoint for council member Q&A.
 * Reads wiki index → selects relevant pages → streams AI response.
 * Provider is controlled by AI_PROVIDER env var (anthropic | openai | gemini).
 */

import { QUERY_SYSTEM_PROMPT } from "@/lib/claude/client";
import { getAIProvider } from "@/lib/ai/provider";
import { appendChatTurn } from "@/lib/chat-log";
import { checkChatRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  readWikiIndex,
  readRelevantPages,
  buildWikiContext,
} from "@/lib/wiki/reader";
import { selectRelevantPages } from "@/lib/wiki/select";
import { appendToLog } from "@/lib/wiki/writer";
import { appendMessage } from "@/lib/db/queries/conversations";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // ── 0. Rate limit before any AI call ─────────────────────────────────────
    // Per-IP in-memory sliding window (CHAT_RATE_LIMIT_RPM, default 20/min).
    // In-memory is sufficient because this deployment runs a single replica
    // (railway.toml: numReplicas = 1); a multi-replica deployment would need
    // a shared store (Redis/Upstash) — see app/lib/rate-limit.ts.
    const rate = checkChatRateLimit(getClientIp(req.headers));
    if (!rate.allowed) {
      // JSON { error } body — the chat UI surfaces this as an inline
      // assistant error message on non-OK responses.
      return new Response(
        JSON.stringify({
          error: `Too many requests — please wait ${rate.retryAfterSeconds} second${rate.retryAfterSeconds === 1 ? "" : "s"} and try again.`,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rate.retryAfterSeconds),
            "X-RateLimit-Limit": String(rate.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const { messages, fileAnswer, conversationId } = await req.json();
    const userMessage: string = messages[messages.length - 1]?.content ?? "";

    const today = new Date().toISOString().split("T")[0];

    // ── 1. Select relevant wiki pages ────────────────────────────────────────

    const indexEntries = readWikiIndex();
    const relevantPaths = selectRelevantPages(userMessage, indexEntries);
    const wikiPages = readRelevantPages(relevantPaths);
    const wikiContext = buildWikiContext(wikiPages, 40_000);

    // ── 2. Build system prompt ───────────────────────────────────────────────

    const systemPrompt = QUERY_SYSTEM_PROMPT.replace("{DATE}", today);

    const contextBlock =
      wikiPages.length > 0
        ? `\n\n## WIKI KNOWLEDGE BASE\n\nThe following wiki pages are relevant to this query:\n\n${wikiContext}`
        : "\n\n## WIKI KNOWLEDGE BASE\n\nNo wiki pages have been ingested yet. " +
          "Run `npm run ingest:seed` to populate the knowledge base.";

    // ── 3. Stream response via provider-agnostic AI client ───────────────────

    const startedAt = Date.now();
    const ai = getAIProvider();
    const aiStream = ai.stream({
      system: systemPrompt + contextBlock,
      maxTokens: 2048,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    // ── 4. Log the query async after stream completes ────────────────────────

    const logQuery = () => {
      try {
        const truncatedQ = userMessage.slice(0, 50);
        const logEntry = `## [${today}] QUERY | ${truncatedQ}
**Question:** ${userMessage}
**Wiki pages read:** ${relevantPaths.join(", ") || "none"}
**Filed:** ${fileAnswer ? "pending" : "not filed"}
**Gap noted:** ${wikiPages.length === 0 ? "No wiki pages ingested — run ingest:seed" : "none"}`;
        appendToLog(logEntry);
      } catch {
        // Log write failures are non-fatal
      }
    };

    // ── 5. Audit log (public-records compliance, issue #146) ─────────────────
    //
    // Every Q&A turn is appended to a monthly JSONL file via appendChatTurn()
    // (fire-and-forget; never throws into the request path). The answer text
    // is accumulated as it is streamed to the client. If the client aborts or
    // disconnects mid-stream, we log the PARTIAL answer that was generated —
    // for records purposes, what was actually shown to the user matters more
    // than whether the stream ran to completion. `auditLogged` guards against
    // double-logging when both the error and cancel paths fire.

    const answerParts: string[] = [];
    let auditLogged = false;
    const logAudit = () => {
      if (auditLogged) return;
      auditLogged = true;
      void appendChatTurn({
        timestamp: new Date().toISOString(),
        question: userMessage,
        answer: answerParts.join(""),
        pagesUsed: relevantPaths,
        provider: `${process.env.AI_PROVIDER ?? "anthropic"}/${ai.model}`,
        latencyMs: Date.now() - startedAt,
      });

      // ── 5b. Conversation persistence (optional — only signed-in users with
      // a selected conversation send this) ─────────────────────────────────
      // Separate from the audit log above: that's a permanent public-records
      // JSONL trail regardless of login state; this is the user-facing,
      // editable/organizable chat history behind real accounts. Fire-and-
      // forget, same rationale — a save failure here shouldn't break the
      // response the user already received.
      if (conversationId && typeof conversationId === "string") {
        void appendMessage(conversationId, "user", userMessage).catch((err) =>
          console.error("[chat] Failed to persist user message:", (err as Error).message)
        );
        void appendMessage(conversationId, "assistant", answerParts.join(""), {
          pagesUsed: relevantPaths,
        }).catch((err) =>
          console.error("[chat] Failed to persist assistant message:", (err as Error).message)
        );
      }
    };

    // Pipe text chunks from the provider into a ReadableStream
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of aiStream) {
            answerParts.push(chunk);
            controller.enqueue(encoder.encode(chunk));
          }
          logQuery();
          logAudit();
        } catch (err) {
          logAudit();
          try {
            controller.enqueue(
              encoder.encode(`\n\n[Error: ${(err as Error).message}]`)
            );
          } catch {
            // Controller already closed (client disconnected) — nothing to send
          }
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed/cancelled
          }
        }
      },
      cancel() {
        // Client disconnected — log the partial answer generated so far
        logAudit();
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    // Top-level error (bad API key, JSON parse, wiki read failure, etc.)
    const message = (err as Error).message ?? "Unknown error";
    console.error("[/api/chat] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

