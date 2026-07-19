/**
 * GET /api/wiki/search?q=budget&category=topic&limit=50&offset=0
 *
 * Full-text search over all wiki pages.
 *
 * Query params:
 *   q        — search string (case-insensitive, title + content match)
 *   category — optional WikiCategory filter (topic | decision | person | recommendation | query)
 *   limit    — max results returned (default 50, clamped to 200)
 *   offset   — pagination offset (default 0)
 *
 * Results are sorted by relevance (title matches weigh more than content
 * matches) BEFORE pagination is applied, so page 1 always holds the best
 * matches. Invalid limit/offset values are clamped, never rejected.
 *
 * Response:
 *   { results: SearchResult[], total: number, limit: number, offset: number }
 *   `total` is the match count before pagination.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFullWiki } from "@/lib/wiki/reader";
import type { WikiPage, WikiCategory } from "@/types";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const EXCERPT_LENGTH = 200;
const TITLE_MATCH_WEIGHT = 10;

export interface SearchResult {
  path: string;
  title: string;
  category: WikiCategory;
  lastUpdated: string;
  excerpt: string;
}

/** Extract a ~200-char excerpt around the first occurrence of `q` in `content`,
 *  highlighting the match term with **bold** markdown. */
export function buildExcerpt(content: string, q: string): string {
  if (!q) {
    // No query — return the first EXCERPT_LENGTH chars as-is
    return content.slice(0, EXCERPT_LENGTH).trimEnd() + (content.length > EXCERPT_LENGTH ? "…" : "");
  }

  const lower = content.toLowerCase();
  const matchIdx = lower.indexOf(q.toLowerCase());

  if (matchIdx === -1) {
    // Match was in the title, not content — return beginning of content
    return content.slice(0, EXCERPT_LENGTH).trimEnd() + (content.length > EXCERPT_LENGTH ? "…" : "");
  }

  // Center the window on the match
  const half = Math.floor(EXCERPT_LENGTH / 2);
  const start = Math.max(0, matchIdx - half);
  const end = Math.min(content.length, start + EXCERPT_LENGTH);
  let excerpt = content.slice(start, end);

  // Re-locate match position inside the excerpt slice
  const excerptLower = excerpt.toLowerCase();
  const qLower = q.toLowerCase();
  const hitIdx = excerptLower.indexOf(qLower);
  if (hitIdx !== -1) {
    const before = excerpt.slice(0, hitIdx);
    const match = excerpt.slice(hitIdx, hitIdx + q.length);
    const after = excerpt.slice(hitIdx + q.length);
    excerpt = `${before}**${match}**${after}`;
  }

  // Add ellipses at boundaries when the window doesn't start/end at content edges
  if (start > 0) excerpt = "…" + excerpt;
  if (end < content.length) excerpt = excerpt + "…";

  return excerpt.trim();
}

/** Count non-overlapping occurrences of `needle` in `haystack` (both pre-lowercased). */
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

/** Filter and score wiki pages against query `q` and optional `category`.
 *  Results are sorted by relevance (descending) — title occurrences weigh
 *  TITLE_MATCH_WEIGHT× more than content occurrences. Ties keep wiki order. */
export function searchWikiPages(
  pages: WikiPage[],
  q: string,
  category?: string
): WikiPage[] {
  const qLower = q.toLowerCase().trim();

  const filtered = pages.filter((page) => {
    // Category filter
    if (category && page.category !== category) return false;

    // If no query, include all (caller handles pagination)
    if (!qLower) return true;

    // Match in title or content (case-insensitive)
    return (
      page.title.toLowerCase().includes(qLower) ||
      page.content.toLowerCase().includes(qLower)
    );
  });

  // No query — nothing to rank; keep wiki order
  if (!qLower) return filtered;

  const scored = filtered.map((page) => ({
    page,
    score:
      countOccurrences(page.title.toLowerCase(), qLower) * TITLE_MATCH_WEIGHT +
      countOccurrences(page.content.toLowerCase(), qLower),
  }));

  // Array.prototype.sort is stable — equal scores keep their original order
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.page);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q") ?? "";
    const category = searchParams.get("category") ?? undefined;

    const rawLimit = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_LIMIT : rawLimit, MAX_LIMIT);
    const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

    const pages = readFullWiki();
    const matched = searchWikiPages(pages, q, category);
    const total = matched.length;
    const paginated = matched.slice(offset, offset + limit);

    const results: SearchResult[] = paginated.map((page) => ({
      path: page.path,
      title: page.title,
      category: page.category,
      lastUpdated: page.lastUpdated,
      excerpt: buildExcerpt(page.content, q),
    }));

    return NextResponse.json({ results, total, limit, offset });
  } catch (err) {
    console.error("[wiki/search] error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
