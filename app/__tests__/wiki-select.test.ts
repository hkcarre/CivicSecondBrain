/**
 * wiki-select.test.ts
 *
 * Tests for app/lib/wiki/select.ts — the TF-IDF page selector shared by the
 * chat QUERY route and the briefing generator. Wrong ranking here silently
 * degrades answer quality rather than crashing, so behavior is pinned down
 * explicitly:
 *
 *  - relevance ranking (best match first)
 *  - empty inputs (no entries, empty/garbage query)
 *  - score threshold → topic-page fallback
 *  - TOP_K cap (8)
 *  - temporal-query decision boost, including the documented DIMINISHING
 *    behavior for older decisions (comment: "apply diminishing boost to
 *    older ones", floor 0 via Math.max) — stale decisions must not crowd
 *    every topically-relevant page out of the result set.
 *
 * select.ts is a pure module (no env-dependent constants), so no
 * vi.resetModules() / dynamic import isolation is needed.
 */

import { describe, it, expect } from "vitest";
import { selectRelevantPages } from "@/lib/wiki/select";
import type { WikiIndexEntry, WikiCategory } from "@/types";

function entry(
  path: string,
  summary: string,
  overrides: Partial<WikiIndexEntry> = {}
): WikiIndexEntry {
  const category: WikiCategory = path.startsWith("decisions/")
    ? ("decision" as WikiCategory)
    : ("topic" as WikiCategory);
  return {
    path,
    summary,
    lastUpdated: "2026-01-01",
    sourceCount: 1,
    category,
    ...overrides,
  };
}

describe("selectRelevantPages — relevance ranking", () => {
  it("ranks the entry matching the query terms first", () => {
    const entries = [
      entry("topics/parks.md", "Parks and recreation facilities and trails"),
      entry("topics/budget.md", "Annual budget appropriations and tax revenue"),
      entry("topics/animal-services.md", "Animal shelter operations and adoptions"),
    ];
    const result = selectRelevantPages("what is the annual budget and tax revenue", entries);
    expect(result[0]).toBe("topics/budget.md");
  });

  it("returns an empty array when there are no entries", () => {
    expect(selectRelevantPages("anything", [])).toEqual([]);
  });

  it("does not include entries wholly unrelated to a specific query above better matches", () => {
    const entries = [
      entry("topics/budget.md", "Annual budget appropriations fiscal year spending"),
      entry("topics/library.md", "Library hours story time and book clubs"),
    ];
    const result = selectRelevantPages("budget fiscal year spending", entries);
    expect(result[0]).toBe("topics/budget.md");
  });
});

describe("selectRelevantPages — fallback behavior", () => {
  it("falls back to topic pages for a query matching nothing", () => {
    const entries = [
      entry("topics/budget.md", "Annual budget appropriations"),
      entry("topics/parks.md", "Parks and recreation"),
      entry("decisions/2026-01-01-city-council.md", "Approved zoning variance"),
    ];
    const result = selectRelevantPages("zzqx wvut kkjj", entries);
    // Fallback returns only topic-category pages, max 5
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(5);
    for (const p of result) expect(p.startsWith("topics/")).toBe(true);
  });

  it("falls back gracefully for an empty query", () => {
    const entries = [
      entry("topics/budget.md", "Annual budget appropriations"),
      entry("topics/parks.md", "Parks and recreation"),
    ];
    const result = selectRelevantPages("", entries);
    expect(Array.isArray(result)).toBe(true);
    for (const p of result) expect(p.startsWith("topics/")).toBe(true);
  });
});

describe("selectRelevantPages — TOP_K cap", () => {
  it("returns at most 8 pages even when many entries match", () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      entry(`topics/budget-${i}.md`, "Annual budget appropriations fiscal year")
    );
    const result = selectRelevantPages("budget fiscal year", entries);
    expect(result.length).toBeLessThanOrEqual(8);
  });
});

describe("selectRelevantPages — temporal decision boost", () => {
  it("boosts decision pages for temporal queries", () => {
    const entries = [
      entry("topics/budget.md", "Annual budget appropriations"),
      entry("decisions/2026-06-01-city-council.md", "Council approved the water rate ordinance"),
    ];
    const result = selectRelevantPages("what did the council vote on at the last meeting", entries);
    expect(result[0]).toBe("decisions/2026-06-01-city-council.md");
  });

  it("prefers newer decisions over older ones for a temporal query", () => {
    const entries = [
      entry("decisions/2024-01-01-city-council.md", "Council meeting minutes and votes", {
        lastUpdated: "2024-01-01",
      }),
      entry("decisions/2026-06-01-city-council.md", "Council meeting minutes and votes", {
        lastUpdated: "2026-06-01",
      }),
    ];
    const result = selectRelevantPages("recent council vote", entries);
    expect(result[0]).toBe("decisions/2026-06-01-city-council.md");
  });

  it("does not let stale, topically-irrelevant decisions crowd out a relevant topic page (diminishing boost)", () => {
    // 8 old decision pages about unrelated matters + 1 topic page that
    // genuinely matches part of the query. The documented behavior is a
    // DIMINISHING recency boost (0.3, 0.25, … floor 0 for the 7th+ oldest),
    // so at most ~6 stale decisions can outrank a moderate topical match —
    // the budget topic page must still make the top-8 result set.
    const staleDecisions = Array.from({ length: 8 }, (_, i) =>
      entry(
        `decisions/2019-0${(i % 8) + 1}-01-city-council.md`,
        "Parade permit street closure proclamation ceremony",
        { lastUpdated: `2019-0${(i % 8) + 1}-01` }
      )
    );
    const entries = [
      ...staleDecisions,
      entry("topics/fire-department.md", "Fire department staffing overtime and equipment funding"),
    ];
    const result = selectRelevantPages(
      "recent fire department overtime funding vote",
      entries
    );
    expect(result).toContain("topics/fire-department.md");
  });

  it("gives no boost to the 7th-oldest and later stale decisions (documented floor of 0)", () => {
    // The in-code comment says "apply diminishing boost to older ones" with
    // an explicit Math.max(0, 0.3 - i * 0.05) floor: the 7th+ most recent
    // decisions (i >= 6) receive zero boost. A stale decision whose text is
    // completely unrelated to the query therefore scores ~0 — below the
    // 0.05 inclusion threshold — and must NOT appear in the results.
    const staleDecisions = Array.from({ length: 8 }, (_, i) =>
      entry(
        `decisions/2019-0${i + 1}-01-city-council.md`,
        "Parade permit street closure proclamation ceremony",
        { lastUpdated: `2019-0${i + 1}-01` }
      )
    );
    const entries = [
      ...staleDecisions,
      entry("topics/budget.md", "Annual budget appropriations fiscal year"),
    ];
    // Temporal query, zero term overlap with the stale decisions
    const result = selectRelevantPages("recent budget vote", entries);

    // The two OLDEST decisions (sorted 7th and 8th by recency → boost 0)
    // have no topical match and must be excluded by the score threshold.
    expect(result).not.toContain("decisions/2019-01-01-city-council.md");
    expect(result).not.toContain("decisions/2019-02-01-city-council.md");
  });
});
