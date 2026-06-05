import { describe, it, expect } from "vitest";
import { searchWikiPages, buildExcerpt } from "../api/wiki/search/route";
import type { WikiPage } from "../types";

// ─── Fixtures ─────────────────────────────────────────────────────────────

function makePage(overrides: Partial<WikiPage> = {}): WikiPage {
  return {
    title: "Budget Overview",
    type: "wiki",
    category: "topic",
    sources: ["budget-fy2024.pdf"],
    lastUpdated: "2024-10-01",
    content: "The city adopted a $42M general fund budget for FY2024.",
    path: "topics/budget.md",
    ...overrides,
  };
}

const PAGES: WikiPage[] = [
  makePage({
    title: "Budget Overview",
    category: "topic",
    path: "topics/budget.md",
    content: "The city adopted a $42M general fund budget for FY2024.",
  }),
  makePage({
    title: "Council Decision on Water Rate",
    category: "decision",
    path: "decisions/2024-01-15-water-rate.md",
    content: "Council approved a 3% water rate increase effective March 2024.",
  }),
  makePage({
    title: "Mayor Bio",
    category: "person",
    path: "people/mayor.md",
    content: "Mayor Jane Doe has served since 2020.",
  }),
  makePage({
    title: "Parks Recommendation",
    category: "recommendation",
    path: "recommendations/parks.md",
    content: "AI ANALYSIS — Parks need $2M in capital improvements.",
  }),
];

// ─── searchWikiPages ───────────────────────────────────────────────────────

describe("searchWikiPages", () => {
  it("returns all pages when q is empty and no category filter", () => {
    const results = searchWikiPages(PAGES, "");
    expect(results).toHaveLength(PAGES.length);
  });

  it("filters by title match (case-insensitive)", () => {
    const results = searchWikiPages(PAGES, "BUDGET");
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("topics/budget.md");
  });

  it("filters by content match", () => {
    const results = searchWikiPages(PAGES, "water rate");
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("decisions/2024-01-15-water-rate.md");
  });

  it("matches in both title and content if applicable", () => {
    // "budget" appears in title AND content; should still return once
    const results = searchWikiPages(PAGES, "42M");
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("topics/budget.md");
  });

  it("returns empty array when no page matches", () => {
    const results = searchWikiPages(PAGES, "nonexistent_term_xyz");
    expect(results).toHaveLength(0);
  });

  it("filters by category when provided", () => {
    const results = searchWikiPages(PAGES, "", "decision");
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe("decision");
  });

  it("combines q and category filter", () => {
    // q=budget, category=decision → no match (budget page is a topic)
    const noMatch = searchWikiPages(PAGES, "budget", "decision");
    expect(noMatch).toHaveLength(0);

    // q=budget, category=topic → matches budget page
    const match = searchWikiPages(PAGES, "budget", "topic");
    expect(match).toHaveLength(1);
    expect(match[0].path).toBe("topics/budget.md");
  });

  it("returns all pages with empty q when category matches multiple", () => {
    const pages = [
      ...PAGES,
      makePage({ category: "topic", path: "topics/parks.md", title: "Parks" }),
    ];
    const results = searchWikiPages(pages, "", "topic");
    expect(results).toHaveLength(2);
    expect(results.every((p) => p.category === "topic")).toBe(true);
  });
});

// ─── buildExcerpt ─────────────────────────────────────────────────────────

describe("buildExcerpt", () => {
  it("returns first 200 chars when q is empty", () => {
    const content = "A".repeat(300);
    const excerpt = buildExcerpt(content, "");
    expect(excerpt.length).toBeLessThanOrEqual(201 + 1); // 200 + "…"
    expect(excerpt).toContain("…");
  });

  it("bolds the matched term in the excerpt", () => {
    const content = "The city adopted a general fund budget for the fiscal year.";
    const excerpt = buildExcerpt(content, "general fund");
    expect(excerpt).toContain("**general fund**");
  });

  it("is case-insensitive for the search term but preserves original casing in bold", () => {
    const content = "The General Fund supports city operations.";
    const excerpt = buildExcerpt(content, "general fund");
    expect(excerpt).toContain("**General Fund**");
  });

  it("adds leading ellipsis when match is not near the start", () => {
    const prefix = "X".repeat(150);
    const content = prefix + " target term here";
    const excerpt = buildExcerpt(content, "target term");
    expect(excerpt.startsWith("…")).toBe(true);
  });

  it("returns beginning of content when q is not found in content", () => {
    const content = "Some unrelated content here.";
    // q matches title but not content — should fall back to beginning
    const excerpt = buildExcerpt(content, "title_match_only");
    expect(excerpt).toContain("Some unrelated content");
  });

  it("does not exceed EXCERPT_LENGTH chars in the content window (ignoring bold markers and ellipsis)", () => {
    const content = "word ".repeat(200); // 1000 chars
    const excerpt = buildExcerpt(content, "word");
    // Strip bold markers and ellipsis to measure raw content length
    const stripped = excerpt.replace(/\*\*/g, "").replace(/…/g, "");
    expect(stripped.length).toBeLessThanOrEqual(210); // small margin for trim/whitespace
  });
});
