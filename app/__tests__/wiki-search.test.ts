/**
 * wiki-search.test.ts
 *
 * Tests for the TF-IDF page selector (via chat route) and the
 * /api/wiki/search endpoint (searchWikiPages + buildExcerpt).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── TF-IDF selector tests (via chat route) ───────────────────────────────

vi.mock("@/lib/wiki/reader", () => ({
  readWikiIndex: vi.fn(),
  readRelevantPages: vi.fn(() => []),
  buildWikiContext: vi.fn(() => ""),
}));

vi.mock("@/lib/wiki/writer", () => ({
  appendToLog: vi.fn(),
}));

// Prevent audit-log writes to ./chat-log during test runs
vi.mock("@/lib/chat-log", () => ({
  appendChatTurn: vi.fn(async () => {}),
}));

vi.mock("@/lib/claude/client", () => ({
  claude: {
    messages: {
      stream: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        finalMessage: vi.fn().mockResolvedValue({}),
        [Symbol.asyncIterator]: async function* () {},
      })),
    },
  },
  MODELS: { sonnet: "claude-sonnet-4-5", haiku: "claude-haiku-4-5" },
  QUERY_SYSTEM_PROMPT: "You are a city assistant. Today is {DATE}.",
  CITY_FULL: "Schertz, TX",
}));

function makeEntry(path: string, summary: string, category: WikiCategory = "topic", lastUpdated = "2024-01-01") {
  return { path, summary, category, lastUpdated, sourceCount: 1 };
}

async function callChat(query: string) {
  vi.resetModules();
  const { readWikiIndex, readRelevantPages } = await import("@/lib/wiki/reader");
  const { POST } = await import("@/api/chat/route");
  const req = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: query }] }),
  });
  await POST(req).catch(() => {});
  return vi.mocked(readRelevantPages).mock.calls[0]?.[0] ?? [];
}

describe("TF-IDF page selector (via chat route)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns empty list when index is empty", async () => {
    const { readWikiIndex } = await import("@/lib/wiki/reader");
    vi.mocked(readWikiIndex).mockReturnValue([]);
    const paths = await callChat("What is the budget?");
    expect(paths).toEqual([]);
  });

  it("ranks budget page higher than unrelated page for budget query", async () => {
    const { readWikiIndex } = await import("@/lib/wiki/reader");
    vi.mocked(readWikiIndex).mockReturnValue([
      makeEntry("topics/budget.md", "City general fund budget revenues expenditures fiscal year"),
      makeEntry("topics/parks.md", "Parks and recreation facilities maintenance"),
    ]);
    const paths = await callChat("What is the total budget expenditure for this fiscal year?");
    expect(paths[0]).toBe("topics/budget.md");
  });

  it("boosts decision pages for temporal queries", async () => {
    const { readWikiIndex } = await import("@/lib/wiki/reader");
    vi.mocked(readWikiIndex).mockReturnValue([
      makeEntry("topics/budget.md", "Budget overview"),
      makeEntry("decisions/2024-06-15-council.md", "Council meeting vote approved", "decision", "2024-06-15"),
    ]);
    const paths = await callChat("What did the council vote on at the last meeting?");
    expect(paths.some((p: string) => p.startsWith("decisions/"))).toBe(true);
  });

  it("falls back to topic pages when nothing scores above threshold", async () => {
    const { readWikiIndex } = await import("@/lib/wiki/reader");
    vi.mocked(readWikiIndex).mockReturnValue([
      makeEntry("topics/budget.md", "Budget fiscal year revenues"),
      makeEntry("topics/parks.md", "Parks recreation facilities"),
    ]);
    const paths = await callChat("xyzzy frobnicator quux");
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((p: string) => p.startsWith("topics/"))).toBe(true);
  });

  it("caps results at 8 pages", async () => {
    const { readWikiIndex } = await import("@/lib/wiki/reader");
    vi.mocked(readWikiIndex).mockReturnValue(
      Array.from({ length: 15 }, (_, i) =>
        makeEntry(`topics/topic${i}.md`, `City topic ${i} overview information`)
      )
    );
    const paths = await callChat("Tell me about city services");
    expect(paths.length).toBeLessThanOrEqual(8);
  });
});

// ─── /api/wiki/search endpoint tests ─────────────────────────────────────

import { searchWikiPages, buildExcerpt } from "../api/wiki/search/route";
import type { WikiCategory, WikiPage } from "../types";

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

describe("searchWikiPages", () => {
  it("returns empty array when pages list is empty", () => {
    expect(searchWikiPages([], "budget")).toEqual([]);
  });

  it("matches query term in page content", () => {
    const pages = [makePage()];
    const results = searchWikiPages(pages, "budget");
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("topics/budget.md");
  });

  it("matches query term in page title", () => {
    const pages = [makePage({ title: "Police Department Report", content: "No match here." })];
    const results = searchWikiPages(pages, "police");
    expect(results).toHaveLength(1);
  });

  it("is case-insensitive", () => {
    const pages = [makePage()];
    expect(searchWikiPages(pages, "BUDGET")).toHaveLength(1);
    expect(searchWikiPages(pages, "Budget")).toHaveLength(1);
  });

  it("returns no results when query does not match", () => {
    const pages = [makePage()];
    expect(searchWikiPages(pages, "zoning")).toHaveLength(0);
  });

  it("ranks pages with more matches higher", () => {
    const pages = [
      makePage({ path: "topics/a.md", content: "budget budget budget" }),
      makePage({ path: "topics/b.md", content: "budget" }),
    ];
    const results = searchWikiPages(pages, "budget");
    expect(results[0].path).toBe("topics/a.md");
  });

  it("handles queries matched as a substring", () => {
    const pages = [
      makePage({ content: "general fund adopted for fiscal year" }),
      makePage({ path: "topics/other.md", content: "No match here" }),
    ];
    // "general fund" is a substring match
    const results = searchWikiPages(pages, "general fund");
    expect(results[0].path).toBe("topics/budget.md");
  });

  it("returns all matching pages sorted by score", () => {
    const pages = [
      makePage({ path: "topics/a.md", content: "water water water sewer" }),
      makePage({ path: "topics/b.md", content: "water" }),
      makePage({ path: "topics/c.md", content: "budget" }),
    ];
    const results = searchWikiPages(pages, "water");
    expect(results.map((r) => r.path)).toEqual(["topics/a.md", "topics/b.md"]);
  });

  it("reorders when a lower-scoring page appears first in the input", () => {
    const pages = [
      makePage({ path: "topics/weak.md", content: "water" }),
      makePage({ path: "topics/strong.md", content: "water water water" }),
    ];
    const results = searchWikiPages(pages, "water");
    expect(results.map((r) => r.path)).toEqual(["topics/strong.md", "topics/weak.md"]);
  });

  it("ranks a title match above a single content match", () => {
    const pages = [
      makePage({ path: "topics/content-hit.md", title: "Misc", content: "water usage" }),
      makePage({ path: "topics/title-hit.md", title: "Water Utility", content: "no term here" }),
    ];
    const results = searchWikiPages(pages, "water");
    expect(results[0].path).toBe("topics/title-hit.md");
  });
});

describe("buildExcerpt", () => {
  it("returns a substring around the first match", () => {
    const content = "The city adopted a $42M general fund budget for FY2024.";
    const excerpt = buildExcerpt(content, "budget");
    expect(excerpt).toContain("budget");
  });

  it("returns beginning of content when query is not found", () => {
    const content = "A".repeat(300);
    const excerpt = buildExcerpt(content, "zoning");
    expect(excerpt.length).toBeLessThanOrEqual(203); // 200 + '...'
  });

  it("appends ellipsis when content is truncated", () => {
    const content = "word ".repeat(100);
    const excerpt = buildExcerpt(content, "word");
    // buildExcerpt uses Unicode ellipsis (…) or trailing dots
    expect(excerpt).toMatch(/[.…]$/);
  });
});
