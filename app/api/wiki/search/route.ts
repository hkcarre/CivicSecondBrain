/**
 * GET /api/wiki/search?q=budget&category=topic&limit=20&offset=0
 *
 * Full-text search over all wiki pages.
 *
 * Query params:
 *   q        — search string (case-insensitive, title + content match)
 *   category — optional WikiCategory filter (topic | decision | person | recommendation | query)
 *   limit    — max results returned (default 20)
 *   offset   — pagination offset (default 0)
 *
 * Response:
 *   { results: SearchResult[], total: number, limit: number, offset: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { readFullWiki } from "@/lib/wiki/reader";
import type { WikiPage, WikiCategory } from "@/types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const EXCERPT_LENGTH = 200;

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

/** Filter and score wiki pages against query `q` and optional `category`. */
export function searchWikiPages(
  pages: WikiPage[],
  q: string,
  category?: string
): WikiPage[] {
  const qLower = q.toLowerCase().trim();

  return pages.filter((page) => {
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
