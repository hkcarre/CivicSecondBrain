/**
 * POST /api/chat
 *
 * Streaming chat endpoint for council member Q&A.
 * Reads wiki index → selects relevant pages → streams Claude response.
 */

// ai v6 dropped StreamingTextResponse — we use the Anthropic SDK stream directly.
import { claude, MODELS, QUERY_SYSTEM_PROMPT } from "@/lib/claude/client";
import {
  readWikiIndex,
  readRelevantPages,
  buildWikiContext,
} from "@/lib/wiki/reader";
import { appendToLog } from "@/lib/wiki/writer";
import type { WikiIndexEntry } from "@/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { messages, fileAnswer } = await req.json();
  const userMessage: string = messages[messages.length - 1]?.content ?? "";

  const today = new Date().toISOString().split("T")[0];

  // ── 1. Select relevant wiki pages ────────────────────────────────────────

  const indexEntries = readWikiIndex();
  const relevantPaths = selectRelevantPages(userMessage, indexEntries);
  const wikiPages = readRelevantPages(relevantPaths);
  const wikiContext = buildWikiContext(wikiPages);

  // ── 2. Build system prompt ───────────────────────────────────────────────

  const systemPrompt = QUERY_SYSTEM_PROMPT.replace("{DATE}", today);

  const contextBlock =
    wikiPages.length > 0
      ? `\n\n## WIKI KNOWLEDGE BASE\n\nThe following wiki pages are relevant to this query:\n\n${wikiContext}`
      : "\n\n## WIKI KNOWLEDGE BASE\n\nNo wiki pages have been ingested yet. " +
        "Run `npm run ingest:seed` to populate the knowledge base.";

  // ── 3. Stream response ───────────────────────────────────────────────────

  const stream = await claude.messages.stream({
    model: MODELS.sonnet,
    max_tokens: 2048,
    system: systemPrompt + contextBlock,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  // ── 4. Log the query (async, non-blocking) ───────────────────────────────

  stream.finalMessage().then((finalMsg) => {
    const truncatedQ = userMessage.slice(0, 50);
    const logEntry = `## [${today}] QUERY | ${truncatedQ}
**Question:** ${userMessage}
**Wiki pages read:** ${relevantPaths.join(", ") || "none"}
**Filed:** ${fileAnswer ? "pending" : "not filed"}
**Gap noted:** ${wikiPages.length === 0 ? "No wiki pages ingested — run ingest:seed" : "none"}`;
    appendToLog(logEntry);
  });

  // Return as streaming response compatible with Vercel AI SDK
  return new Response(stream.toReadableStream(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}

// ─── Simple keyword-based page selector ───────────────────────────────────
//
// At POC scale (<200 wiki pages) we use keyword matching instead of
// vector search. For production, replace with OpenSearch k-NN.
//

function selectRelevantPages(
  query: string,
  entries: WikiIndexEntry[]
): string[] {
  const q = query.toLowerCase();

  const TOPIC_KEYWORDS: Record<string, string[]> = {
    "topics/budget.md": [
      "budget", "spend", "cost", "finance", "revenue", "expenditure",
      "debt", "fund", "fiscal", "tax", "dollar", "million", "cip",
      "capital", "pension", "retirement",
    ],
    "topics/ordinances.md": [
      "ordinance", "code", "law", "regulation", "municode", "pass",
      "enact", "repeal", "amend", "chapter", "section",
    ],
    "topics/infrastructure.md": [
      "road", "street", "park", "utility", "water", "sewer", "drainage",
      "facility", "maintenance", "repair", "construction", "cip",
      "capital improvement",
    ],
    "topics/public-safety.md": [
      "police", "fire", "safety", "court", "crime", "emergency",
      "ems", "ambulance", "officer", "dispatch",
    ],
    "topics/development.md": [
      "zoning", "zone", "development", "permit", "build", "plat",
      "subdivision", "edc", "economic", "commercial", "residential",
      "planning", "variance",
    ],
    "topics/governance.md": [
      "charter", "council", "election", "mayor", "member", "bylaws",
      "term", "vote", "quorum", "board", "commission",
    ],
    "topics/strategic-plan.md": [
      "strategic", "goal", "plan", "priority", "initiative", "kpi",
      "progress", "objective", "2024", "2025",
    ],
  };

  const selected = new Set<string>();

  // Always include a recent decisions page if asking about meetings
  if (
    q.includes("meeting") ||
    q.includes("last") ||
    q.includes("recent") ||
    q.includes("vote") ||
    q.includes("decided")
  ) {
    // Find most recent decisions pages
    const decisionPages = entries
      .filter((e) => e.path.startsWith("decisions/"))
      .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
      .slice(0, 3);
    decisionPages.forEach((p) => selected.add(p.path));
  }

  // Keyword matching for topic pages
  for (const [pagePath, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => q.includes(kw))) {
      selected.add(pagePath);
    }
  }

  // Include any matching indexed pages (from their summaries)
  for (const entry of entries) {
    if (
      entry.summary.toLowerCase().split(" ").some((word) => q.includes(word))
    ) {
      selected.add(entry.path);
    }
  }

  // If nothing matched, return all topic pages (broad query)
  if (selected.size === 0) {
    return entries
      .filter((e) => e.category === "topic")
      .map((e) => e.path)
      .slice(0, 5);
  }

  return Array.from(selected).slice(0, 8); // cap at 8 pages per query
}
