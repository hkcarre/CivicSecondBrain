/**
 * Tests for POST /api/lint
 *
 * This route had zero test coverage before this file — unlike the
 * structurally-similar /api/ingest and /api/briefing routes, which both
 * have dedicated auth + logic tests. Covers:
 *  - route auth (401 without secret when INGEST_SECRET set; open in dev)
 *  - "no wiki pages" short-circuit
 *  - JSON extraction from both fenced (```json ... ```) and raw responses
 *  - recommendations are QUEUED for review (pending-review.ts) rather than
 *    written live — LINT recommendations directly influence council
 *    decisions, so they get the same human-checkpoint ingested wiki content
 *    now gets. Tests that need the eventual live page/index/log content
 *    call approveReview() first, same as a reviewer clicking Approve would.
 *  - 500 with a clean error message when the AI response has no
 *    parseable JSON
 *
 * Strategy: mock only the AI provider and next/cache revalidatePath;
 * exercise the real wiki reader/writer against a temp WIKI_PATH, following
 * the pattern established in briefing.test.ts.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import matter from "gray-matter";

// ─── Module mocks ────────────────────────────────────────────────────────────

const mockComplete = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

vi.mock("@/lib/ai/provider", () => ({
  getAIProvider: () => ({
    complete: mockComplete,
    stream: vi.fn(),
    model: "test-model",
  }),
  resetAIProvider: vi.fn(),
}));

// ─── Test setup ──────────────────────────────────────────────────────────────

let tmpWiki: string;

const INDEX_SEED = `# CivicSecondBrain Wiki Index
> City: Schertz, TX | Last updated: 2026-01-01 | Pages: 1 | Sources ingested: 1

## Topics
| Page | Summary | Last Updated | Sources |
|---|---|---|---|
| [[topics/budget.md]] | City budget revenue expenditures debt | 2026-01-01 | 3 |

## Recommendations
| Page | Summary | Last Updated | Sources |
|---|---|---|---|
`;

const BUDGET_PAGE = `---
title: "Budget"
type: wiki
category: topic
sources:
  - budget-fy2026.pdf
last_updated: "2026-01-01"
---
The FY2026 general fund budget is $48.2M (FY2026). [SOURCE: budget-fy2026.pdf, p.4]
`;

function recommendationJson(count = 1): string {
  const recommendations = Array.from({ length: count }, (_, i) => ({
    title: `Recommendation ${i + 1}`,
    severity: i === 0 ? "high" : "medium",
    finding: `Finding ${i + 1} about the budget.`,
    evidence: [`Evidence ${i + 1}`],
    comparableCities: ["Cibolo, TX"],
    suggestedAction: `Do action ${i + 1}.`,
    discussionQuestions: [`Question ${i + 1}?`],
    sourcesAnalyzed: ["topics/budget.md"],
  }));
  return JSON.stringify({
    recommendations,
    stalePages: ["topics/parks.md"],
    topActions: ["Review budget", "Audit contracts", "Update charter"],
  });
}

function seedWiki() {
  fs.writeFileSync(path.join(tmpWiki, "index.md"), INDEX_SEED);
  fs.mkdirSync(path.join(tmpWiki, "topics"), { recursive: true });
  fs.writeFileSync(path.join(tmpWiki, "topics/budget.md"), BUDGET_PAGE);
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/lint", {
    method: "POST",
    headers,
  });
}

/** Approves every currently-queued review item — mirrors a reviewer clicking Approve on each. */
async function approveAllPending() {
  const { listPendingReviews, approveReview } = await import("@/lib/wiki/pending-review");
  for (const item of listPendingReviews()) {
    approveReview(item.id);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  tmpWiki = fs.mkdtempSync(path.join(os.tmpdir(), "lint-wiki-"));
  process.env.WIKI_PATH = tmpWiki;
  delete process.env.INGEST_SECRET;
});

afterEach(() => {
  fs.rmSync(tmpWiki, { recursive: true, force: true });
  delete process.env.WIKI_PATH;
  delete process.env.INGEST_SECRET;
});

describe("POST /api/lint — auth", () => {
  it("returns 401 without the secret when INGEST_SECRET is set", async () => {
    process.env.INGEST_SECRET = "test-secret";
    seedWiki();
    const { POST } = await import("@/api/lint/route");

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    expect(mockComplete).not.toHaveBeenCalled();
    // No recommendation should have been written on an unauthorized request.
    expect(fs.existsSync(path.join(tmpWiki, "recommendations"))).toBe(false);
  });

  it("accepts the request with a valid bearer secret", async () => {
    process.env.INGEST_SECRET = "test-secret";
    seedWiki();
    mockComplete.mockResolvedValue(recommendationJson(1));
    const { POST } = await import("@/api/lint/route");

    const res = await POST(
      makeRequest({ Authorization: "Bearer test-secret" })
    );

    expect(res.status).toBe(200);
  });

  it("stays open when INGEST_SECRET is not configured (dev mode)", async () => {
    seedWiki();
    mockComplete.mockResolvedValue(recommendationJson(1));
    const { POST } = await import("@/api/lint/route");

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mockComplete).toHaveBeenCalledOnce();
  });
});

describe("POST /api/lint — empty wiki", () => {
  it("short-circuits with 0 recommendations when no wiki pages exist", async () => {
    fs.writeFileSync(path.join(tmpWiki, "index.md"), INDEX_SEED);
    // No topics/ dir — readFullWiki() finds nothing to analyze.
    const { POST } = await import("@/api/lint/route");

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.recommendations).toBe(0);
    expect(data.message).toMatch(/No wiki pages found/);
    expect(mockComplete).not.toHaveBeenCalled();
  });
});

describe("POST /api/lint — JSON extraction and recommendation writing", () => {
  it("parses a fenced ```json response and writes a recommendation page", async () => {
    seedWiki();
    mockComplete.mockResolvedValue("```json\n" + recommendationJson(1) + "\n```");
    const { POST } = await import("@/api/lint/route");

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.recommendations).toBe(1);
    expect(data.paths).toHaveLength(1);

    // Queued, not live yet.
    expect(fs.existsSync(path.join(tmpWiki, data.paths[0]))).toBe(false);

    await approveAllPending();

    const written = fs.readFileSync(
      path.join(tmpWiki, data.paths[0]),
      "utf-8"
    );
    const parsed = matter(written);
    expect(parsed.data.category).toBe("recommendation");
    expect(parsed.content).toContain("AI ANALYSIS — Requires Council Review");
    expect(parsed.content).toContain("Finding 1 about the budget.");
  });

  it("parses a raw (unfenced) JSON response", async () => {
    seedWiki();
    mockComplete.mockResolvedValue(recommendationJson(2));
    const { POST } = await import("@/api/lint/route");

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.recommendations).toBe(2);
    expect(data.paths).toHaveLength(2);
  });

  it("updates wiki/index.md with the new recommendation entries", async () => {
    seedWiki();
    mockComplete.mockResolvedValue(recommendationJson(1));
    const { POST } = await import("@/api/lint/route");

    await POST(makeRequest());
    await approveAllPending();

    const index = fs.readFileSync(path.join(tmpWiki, "index.md"), "utf-8");
    expect(index).toContain("recommendations/");
  });

  it("appends a log entry with severity counts once approved", async () => {
    seedWiki();
    mockComplete.mockResolvedValue(recommendationJson(2)); // 1 high, 1 medium
    const { POST } = await import("@/api/lint/route");

    await POST(makeRequest());
    // Not written yet — the log entry is part of the queued item too.
    expect(fs.existsSync(path.join(tmpWiki, "log.md"))).toBe(false);

    await approveAllPending();

    const log = fs.readFileSync(path.join(tmpWiki, "log.md"), "utf-8");
    expect(log).toContain("LINT | full");
    expect(log).toContain("1 high");
    expect(log).toContain("1 medium");
  });

  it("does not bust the dashboard ISR cache itself — that happens on approval, not on generation", async () => {
    seedWiki();
    mockComplete.mockResolvedValue(recommendationJson(1));
    const { POST } = await import("@/api/lint/route");

    await POST(makeRequest());

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("returns 500 with a clean message when the AI response has no parseable JSON", async () => {
    seedWiki();
    mockComplete.mockResolvedValue("Sorry, I cannot help with that.");
    const { POST } = await import("@/api/lint/route");

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.message).toContain("Claude returned no parseable JSON");
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
