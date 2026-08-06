/**
 * pending-review.test.ts
 *
 * Tests for app/lib/wiki/pending-review.ts — the review queue that sits
 * between the ingest/LINT pipelines and the live wiki (see that module's
 * own comment for why it exists). Covers:
 *  - queueForReview() + listPendingReviews() round-trip, newest first
 *  - approveReview() replays each PendingAction kind through the real
 *    writer.ts functions against a temp WIKI_PATH, then removes the item
 *  - approveReview()/rejectReview() on an unknown id return false rather
 *    than throwing
 *  - rejectReview() discards the item without writing anything live
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { Recommendation } from "../types";

let tmpDir: string;

async function importModule() {
  vi.resetModules();
  return import("../lib/wiki/pending-review");
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pending-review-test-"));
  process.env.WIKI_PATH = tmpDir;
  // Minimal index seed with the section headers updateWikiIndex() expects.
  fs.writeFileSync(
    path.join(tmpDir, "index.md"),
    `# Wiki Index\n\n## Topics\n\n| Page | Summary | Last Updated | Sources |\n|---|---|---|---|\n\n## Recommendations\n\n| Page | Summary | Last Updated | Sources |\n|---|---|---|---|\n`,
    "utf-8"
  );
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.WIKI_PATH;
});

describe("queueForReview / listPendingReviews", () => {
  it("round-trips a queued item and lists newest first", async () => {
    const { queueForReview, listPendingReviews } = await importModule();

    const first = queueForReview({
      title: "First Document",
      preview: "First summary",
      actions: [],
      indexEntries: [],
    });
    const second = queueForReview({
      title: "Second Document",
      preview: "Second summary",
      actions: [],
      indexEntries: [],
    });

    const items = listPendingReviews();
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe(second.id);
    expect(items[1].id).toBe(first.id);
  });

  it("returns an empty list when nothing is queued", async () => {
    const { listPendingReviews } = await importModule();
    expect(listPendingReviews()).toEqual([]);
  });
});

describe("approveReview", () => {
  it("writes a queued create-page action live, applies index entries and the log entry, then removes the item", async () => {
    const { queueForReview, approveReview, listPendingReviews } = await importModule();

    const item = queueForReview({
      title: "FY2026 Budget",
      preview: "Adopted the annual budget.",
      actions: [
        {
          kind: "create-page",
          page: {
            title: "Budget & Finance",
            type: "wiki",
            category: "topic",
            sources: ["FY2026 Budget"],
            lastUpdated: "2026-06-01",
            content: "## Overview\n\nGeneral fund adopted at $42M.",
            path: "topics/budget.md",
          },
        },
      ],
      indexEntries: [
        {
          path: "topics/budget.md",
          summary: "Adopted the annual budget.",
          date: "2026-06-01",
          sourceCount: 1,
          category: "topic",
        },
      ],
      logEntry: "## [2026-06-01] INGEST | FY2026 Budget\n**Source:** test",
    });

    expect(fs.existsSync(path.join(tmpDir, "topics/budget.md"))).toBe(false);

    const ok = approveReview(item.id);
    expect(ok).toBe(true);

    const page = fs.readFileSync(path.join(tmpDir, "topics/budget.md"), "utf-8");
    expect(page).toContain("General fund adopted at $42M.");

    const index = fs.readFileSync(path.join(tmpDir, "index.md"), "utf-8");
    expect(index).toContain("topics/budget.md");

    const log = fs.readFileSync(path.join(tmpDir, "log.md"), "utf-8");
    expect(log).toContain("INGEST | FY2026 Budget");

    expect(listPendingReviews()).toEqual([]);
  });

  it("replays an append-page action onto an existing page", async () => {
    const { queueForReview, approveReview } = await importModule();

    fs.mkdirSync(path.join(tmpDir, "topics"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "topics/budget.md"),
      `---\ntitle: "Budget"\ntype: wiki\ncategory: topic\nsources: []\nlast_updated: "2026-01-01"\n---\n\nExisting content.\n`,
      "utf-8"
    );

    const item = queueForReview({
      title: "FY2027 Budget Amendment",
      preview: "Amended the budget.",
      actions: [
        {
          kind: "append-page",
          pagePath: "topics/budget.md",
          sectionHeading: "From FY2027 Budget Amendment (2027-01-01)",
          content: "- Reserve fund increased to 25%.",
          updatedDate: "2027-01-01",
        },
      ],
      indexEntries: [],
    });

    approveReview(item.id);

    const page = fs.readFileSync(path.join(tmpDir, "topics/budget.md"), "utf-8");
    expect(page).toContain("Existing content.");
    expect(page).toContain("Reserve fund increased to 25%.");
  });

  it("replays a create-decisions action", async () => {
    const { queueForReview, approveReview } = await importModule();

    const item = queueForReview({
      title: "June Minutes",
      preview: "Council approved the water rate ordinance.",
      actions: [
        {
          kind: "create-decisions",
          meetingDate: "2026-06-15",
          board: "city-council",
          content: "## Votes & Decisions\n\nApproved water rate ordinance.",
          sources: ["June Minutes"],
        },
      ],
      indexEntries: [],
    });

    approveReview(item.id);

    const page = fs.readFileSync(
      path.join(tmpDir, "decisions/2026-06-15-city-council.md"),
      "utf-8"
    );
    expect(page).toContain("Approved water rate ordinance.");
  });

  it("replays a create-recommendation action", async () => {
    const { queueForReview, approveReview } = await importModule();

    const recommendation: Recommendation = {
      id: "2026-06-01-test-rec",
      title: "Test Recommendation",
      severity: "high",
      finding: "The budget trend is concerning.",
      evidence: ["Evidence one."],
      suggestedAction: "Review spending.",
      discussionQuestions: ["What changed?"],
      sourcesAnalyzed: ["topics/budget.md"],
      generatedAt: "2026-06-01",
      path: "recommendations/2026-06-01-test-recommendation.md",
    };

    const item = queueForReview({
      title: "LINT nightly analysis",
      preview: "1 recommendation",
      actions: [{ kind: "create-recommendation", recommendation }],
      indexEntries: [],
    });

    approveReview(item.id);

    const page = fs.readFileSync(
      path.join(tmpDir, "recommendations/2026-06-01-test-recommendation.md"),
      "utf-8"
    );
    expect(page).toContain("AI ANALYSIS — Requires Council Review");
    expect(page).toContain("The budget trend is concerning.");
  });

  it("returns false for an unknown id without throwing", async () => {
    const { approveReview } = await importModule();
    expect(approveReview("does-not-exist")).toBe(false);
  });
});

describe("rejectReview", () => {
  it("discards the item without writing anything live", async () => {
    const { queueForReview, rejectReview, listPendingReviews } = await importModule();

    const item = queueForReview({
      title: "Rejected Document",
      preview: "Should never go live.",
      actions: [
        {
          kind: "create-page",
          page: {
            title: "Should Not Exist",
            type: "wiki",
            category: "topic",
            sources: [],
            lastUpdated: "2026-01-01",
            content: "This should never be written.",
            path: "topics/rejected.md",
          },
        },
      ],
      indexEntries: [],
    });

    const ok = rejectReview(item.id);
    expect(ok).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "topics/rejected.md"))).toBe(false);
    expect(listPendingReviews()).toEqual([]);
  });

  it("returns false for an unknown id without throwing", async () => {
    const { rejectReview } = await importModule();
    expect(rejectReview("does-not-exist")).toBe(false);
  });
});
