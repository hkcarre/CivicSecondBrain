/**
 * app/lib/wiki/select.ts
 *
 * TF-IDF semantic page selector — shared by the chat QUERY route and the
 * briefing generator.
 *
 * Scores each wiki index entry against a free-text query using TF-IDF cosine
 * similarity over the entry's path + summary text. This replaces the old
 * hardcoded keyword map and performs meaningfully better on paraphrased or
 * broader queries.
 *
 * Design:
 *  - Tokenise: lowercase, strip punctuation, split on whitespace
 *  - IDF: computed over the full index on each request (index is <500 entries)
 *  - TF: raw term frequency within the entry text
 *  - Score: cosine similarity between query and entry TF-IDF vectors
 *  - Boosts: recent decision pages for temporal queries (unchanged)
 *  - Fallback: if no entry scores above threshold, return top topic pages
 *
 * When the wiki grows to thousands of pages and latency becomes an issue,
 * replace this with OpenSearch k-NN or sqlite-vec + text-embedding-3-small.
 */

import type { WikiIndexEntry } from "@/types";

const TOP_K = 8;          // max pages returned per query
const SCORE_THRESHOLD = 0.05; // min cosine sim to include a page

// Exported so other selectors over small corpora (e.g. numeric metrics —
// see app/lib/db/queries/metrics.ts's selectRelevantMetrics) can reuse the
// same TF-IDF/cosine approach instead of reimplementing it.
export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function buildIdf(documents: string[][]): Map<string, number> {
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

export function tfidfVector(
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

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
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

export function selectRelevantPages(
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
    // Sort decisions by recency and apply a diminishing boost to older ones:
    // 0.3 for the newest, −0.05 per step, floor 0 from the 7th onward. The
    // boost is applied exactly once — a flat boost for all decision pages
    // would keep stale, topically-irrelevant decisions above the score
    // threshold on every temporal query (#233).
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
