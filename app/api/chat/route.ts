/**
 * POST /api/chat
 *
 * Streaming chat endpoint for council member Q&A.
 * Reads wiki index → selects relevant pages → streams AI response.
 * Provider is controlled by AI_PROVIDER env var (anthropic | openai | gemini).
 */

import { QUERY_SYSTEM_PROMPT } from "@/lib/claude/client";
import { getAIProvider } from "@/lib/ai/provider";
import {
  readWikiIndex,
  readRelevantPages,
  buildWikiContext,
} from "@/lib/wiki/reader";
import { appendToLog } from "@/lib/wiki/writer";
import type { WikiIndexEntry } from "@/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { messages, fileAnswer } = await req.json();
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

    // Pipe text chunks from the provider into a ReadableStream
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of aiStream) {
            controller.enqueue(encoder.encode(chunk));
          }
          logQuery();
        } catch (err) {
          controller.enqueue(
            encoder.encode(`\n\n[Error: ${(err as Error).message}]`)
          );
        } finally {
          controller.close();
        }
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

// ─── TF-IDF semantic page selector ────────────────────────────────────────
//
// Scores each wiki index entry against the user query using TF-IDF cosine
// similarity over the entry's path + summary text. This replaces the old
// hardcoded keyword map and performs meaningfully better on paraphrased or
// broader queries.
//
// Design:
//  - Tokenise: lowercase, strip punctuation, split on whitespace
//  - IDF: computed over the full index on each request (index is <500 entries)
//  - TF: raw term frequency within the entry text
//  - Score: cosine similarity between query and entry TF-IDF vectors
//  - Boosts: recent decision pages for temporal queries (unchanged)
//  - Fallback: if no entry scores above threshold, return top topic pages
//
// When the wiki grows to thousands of pages and latency becomes an issue,
// replace this with OpenSearch k-NN or sqlite-vec + text-embedding-3-small.

const TOP_K = 8;          // max pages returned per query
const SCORE_THRESHOLD = 0.05; // min cosine sim to include a page

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function buildIdf(documents: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const doc of documents) {
    for (const term of new Set(doc)) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const N = documents.length;
  const idf = new Map<string, number>();
  for (const [term, freq] of df) {
    idf.set(term, Math.log((N + 1) / (freq + 1)) + 1); // smoothed
  }
  return idf;
}

function tfidfVector(
  tokens: string[],
  idf: Map<string, number>
): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const vec = new Map<string, number>();
  for (const [t, freq] of tf) {
    vec.set(t, (freq / tokens.length) * (idf.get(t) ?? 1));
  }
  return vec;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [t, v] of a) {
    dot += v * (b.get(t) ?? 0);
    normA += v * v;
  }
  for (const v of b.values()) normB += v * v;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function selectRelevantPages(
  query: string,
  entries: WikiIndexEntry[]
): string[] {
  if (entries.length === 0) return [];

  const q = query.toLowerCase();
  const queryTokens = tokenise(query);

  // ── Build IDF corpus from all entry texts ─────────────────────────────
  const entryTexts = entries.map((e) =>
    tokenise(`${e.path} ${e.summary} ${e.category}`)
  );
  const idf = buildIdf([queryTokens, ...entryTexts]);

  // ── Score every entry ─────────────────────────────────────────────────
  const queryVec = tfidfVector(queryTokens, idf);
  const scored: Array<{ path: string; score: number; entry: WikiIndexEntry }> =
    entries.map((entry, i) => ({
      path: entry.path,
      score: cosine(queryVec, tfidfVector(entryTexts[i], idf)),
      entry,
    }));

  // ── Boost recent decision pages for temporal queries ──────────────────
  const isTemporalQuery =
    q.includes("meeting") ||
    q.includes("last") ||
    q.includes("recent") ||
    q.includes("vote") ||
    q.includes("decided");

  if (isTemporalQuery) {
    const decisionBoost = 0.3;
    for (const s of scored) {
      if (s.entry.path.startsWith("decisions/")) {
        s.score += decisionBoost;
      }
    }
    // Sort decisions by recency and apply diminishing boost to older ones
    const decisionEntries = scored
      .filter((s) => s.entry.path.startsWith("decisions/"))
      .sort((a, b) =>
        b.entry.lastUpdated.localeCompare(a.entry.lastUpdated)
      );
    decisionEntries.forEach((s, i) => {
      s.score += Math.max(0, decisionBoost - i * 0.05);
    });
  }

  // ── Take top-K above threshold ────────────────────────────────────────
  const topK = scored
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score >= SCORE_THRESHOLD)
    .slice(0, TOP_K)
    .map((s) => s.path);

  // ── Fallback: return top topic pages if nothing scored ────────────────
  if (topK.length === 0) {
    return entries
      .filter((e) => e.category === "topic")
      .map((e) => e.path)
      .slice(0, 5);
  }

  return topK;
}

