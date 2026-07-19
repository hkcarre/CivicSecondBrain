/**
 * ingest-engine.test.ts
 *
 * Tests for app/lib/claude/ingest-engine.ts — the INGEST core that turns a
 * parsed document into wiki pages. This was the least-covered high-risk
 * module in the repo (~6% statements before this file).
 *
 * Strategy: mock ONLY the AI provider (the repo-standard "@/lib/ai/provider"
 * mock from briefing.test.ts); everything else — parser, wiki writer/reader,
 * index/log — runs for real against a temp WIKI_PATH fixture, following the
 * vi.resetModules() + dynamic import pattern (module-level path constants).
 *
 * Matrix:
 *  - missing localPath → throws
 *  - happy path (.txt): topic stub created, index updated, log appended,
 *    IngestResult fields formatted (keyFacts joined, dollarAmounts with FY)
 *  - fenced ```json response parses; bare-JSON response parses
 *  - malformed AI response (no JSON) → clear error
 *  - meeting-minutes with keyDecisions → decisions page with votes + [SOURCE:]
 *  - existing topic page → append path (pagesUpdated, not created)
 *  - topic relevance filter in buildTopicUpdate (documented by the strict
 *    dollarAmounts filter next to it): facts unrelated to the topic must not
 *    be appended to that topic's page when relevant facts exist
 *  - unsupported file extension → graceful skipped:true result with NO AI
 *    call (documented in CLAUDE.md; IngestResult.skipped machinery in
 *    /api/ingest and manual-ingest depends on it)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { CivicDocument } from "@/types";

const mockComplete = vi.fn();

vi.mock("@/lib/ai/provider", () => ({
  getAIProvider: () => ({
    complete: mockComplete,
    stream: vi.fn(),
    model: "test-model",
  }),
  resetAIProvider: vi.fn(),
}));

let tmpDir: string;
let docsDir: string;

async function importEngine() {
  vi.resetModules();
  return import("@/lib/claude/ingest-engine");
}

function extraction(overrides: Record<string, unknown> = {}) {
  return {
    documentType: "budget",
    documentDate: "2026-06-01",
    summary: "Adopted the annual operating budget.",
    keyDecisions: [],
    dollarAmounts: [],
    ordinancesReferenced: [],
    namedEntities: { people: [], departments: [], locations: [], externalOrgs: [] },
    topicsAffected: ["budget"],
    keyFacts: ["General fund budget adopted at $42M"],
    openQuestions: [],
    ...overrides,
  };
}

function makeDoc(overrides: Partial<CivicDocument> = {}): CivicDocument {
  const txtPath = path.join(docsDir, overrides.localPath ?? "doc.txt");
  if (!fs.existsSync(txtPath)) {
    fs.writeFileSync(txtPath, "City of Schertz budget document text.", "utf-8");
  }
  return {
    id: "test-doc-1",
    title: "FY2026 Budget",
    sourceUrl: "https://example.gov/budget.pdf",
    type: "budget",
    date: "2026-06-01",
    ...overrides,
    localPath: txtPath,
  } as CivicDocument;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ingest-engine-test-"));
  docsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ingest-engine-docs-"));
  process.env.WIKI_PATH = tmpDir;
  // Minimal index seed with section headers the index updater expects
  fs.writeFileSync(
    path.join(tmpDir, "index.md"),
    `# Wiki Index\n\n## Topics\n\n| Page | Summary | Last Updated | Sources |\n|---|---|---|---|\n\n## Decisions\n\n| Page | Summary | Last Updated | Sources |\n|---|---|---|---|\n`,
    "utf-8"
  );
  mockComplete.mockReset();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(docsDir, { recursive: true, force: true });
  delete process.env.WIKI_PATH;
});

describe("ingestDocument — input guards", () => {
  it("throws when the document has no localPath", async () => {
    const { ingestDocument } = await importEngine();
    const doc = makeDoc();
    delete (doc as { localPath?: string }).localPath;
    await expect(ingestDocument(doc)).rejects.toThrow(/no local path/i);
    expect(mockComplete).not.toHaveBeenCalled();
  });
});

describe("ingestDocument — happy path", () => {
  it("creates a topic stub, updates the index, appends the log, and formats the result", async () => {
    mockComplete.mockResolvedValue(
      "```json\n" +
        JSON.stringify(
          extraction({
            dollarAmounts: [
              {
                description: "General fund",
                amount: "$42M",
                fiscalYear: "FY2026",
                context: "budget adoption",
              },
            ],
          })
        ) +
        "\n```"
    );
    const { ingestDocument } = await importEngine();
    const result = await ingestDocument(makeDoc());

    expect(result.success).toBe(true);
    expect(result.pagesCreated).toContain("topics/budget.md");
    expect(result.keyFacts).toContain("General fund budget adopted at $42M");
    expect(result.dollarAmounts).toContain("General fund: $42M (FY2026)");
    expect(result.votesRecorded).toBe(0);

    // Topic stub written with citation
    const stub = fs.readFileSync(path.join(tmpDir, "topics/budget.md"), "utf-8");
    expect(stub).toContain("[SOURCE: FY2026 Budget]");

    // Index gained the row; log has the INGEST entry
    expect(fs.readFileSync(path.join(tmpDir, "index.md"), "utf-8")).toContain("topics/budget.md");
    expect(fs.readFileSync(path.join(tmpDir, "log.md"), "utf-8")).toContain("INGEST | FY2026 Budget");
  });

  it("parses a bare-JSON (unfenced) AI response", async () => {
    mockComplete.mockResolvedValue(JSON.stringify(extraction()));
    const { ingestDocument } = await importEngine();
    const result = await ingestDocument(makeDoc());
    expect(result.success).toBe(true);
    expect(result.pagesCreated).toContain("topics/budget.md");
  });

  it("throws a clear error when the AI response contains no JSON", async () => {
    mockComplete.mockResolvedValue("I'm sorry, I can't process this document.");
    const { ingestDocument } = await importEngine();
    await expect(ingestDocument(makeDoc())).rejects.toThrow(/no parseable JSON/i);
  });
});

describe("ingestDocument — decisions pages", () => {
  it("creates a decisions page for meeting minutes with recorded votes", async () => {
    mockComplete.mockResolvedValue(
      JSON.stringify(
        extraction({
          documentType: "meeting-minutes",
          topicsAffected: [],
          keyDecisions: [
            {
              description: "Approved water rate ordinance",
              vote: "Passed",
              ayes: 5,
              noes: 2,
              ordinanceNumber: "ORD-26-14",
            },
          ],
        })
      )
    );
    const { ingestDocument } = await importEngine();
    const result = await ingestDocument(
      makeDoc({ type: "meeting-minutes", board: "city-council", title: "June Minutes" })
    );

    expect(result.votesRecorded).toBe(1);
    expect(result.pagesCreated.some((p) => p.startsWith("decisions/"))).toBe(true);

    const decisionPath = result.pagesCreated.find((p) => p.startsWith("decisions/"))!;
    const page = fs.readFileSync(path.join(tmpDir, decisionPath), "utf-8");
    expect(page).toContain("Approved water rate ordinance");
    expect(page).toContain("5 Ayes / 2 Noes");
    expect(page).toContain("ORD-26-14");
    expect(page).toContain("[SOURCE: June Minutes]");
  });

  it("does not create a decisions page when there are no decisions", async () => {
    mockComplete.mockResolvedValue(JSON.stringify(extraction({ documentType: "meeting-minutes" })));
    const { ingestDocument } = await importEngine();
    const result = await ingestDocument(makeDoc({ type: "meeting-minutes" }));
    expect(result.pagesCreated.some((p) => p.startsWith("decisions/"))).toBe(false);
  });
});

describe("ingestDocument — existing topic pages", () => {
  it("appends to an existing topic page instead of recreating it", async () => {
    // Pre-create the budget topic page
    fs.mkdirSync(path.join(tmpDir, "topics"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "topics/budget.md"),
      `---\ntitle: "Budget"\ntype: wiki\ncategory: topic\nsources: []\nlast_updated: "2026-01-01"\n---\n\n## Overview\n\nExisting content.\n`,
      "utf-8"
    );
    mockComplete.mockResolvedValue(JSON.stringify(extraction()));
    const { ingestDocument } = await importEngine();
    const result = await ingestDocument(makeDoc());

    expect(result.pagesUpdated).toContain("topics/budget.md");
    expect(result.pagesCreated).not.toContain("topics/budget.md");

    const page = fs.readFileSync(path.join(tmpDir, "topics/budget.md"), "utf-8");
    expect(page).toContain("Existing content.");
    expect(page).toContain("General fund budget adopted at $42M");
  });

  it("only appends facts relevant to the topic when relevant facts exist", async () => {
    // Two topics affected; facts clearly belong to one topic each. The
    // strict relevance filter (mirroring the dollarAmounts filter beside it)
    // must not append the animal-shelter fact to the budget page.
    fs.mkdirSync(path.join(tmpDir, "topics"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "topics/budget.md"),
      `---\ntitle: "Budget"\ntype: wiki\ncategory: topic\nsources: []\nlast_updated: "2026-01-01"\n---\n\n## Overview\n\nBudget page.\n`,
      "utf-8"
    );
    mockComplete.mockResolvedValue(
      JSON.stringify(
        extraction({
          topicsAffected: ["budget"],
          keyFacts: [
            "Budget reserve fund increased to 25 percent",
            "Animal shelter kennel expansion approved",
          ],
        })
      )
    );
    const { ingestDocument } = await importEngine();
    await ingestDocument(makeDoc());

    const page = fs.readFileSync(path.join(tmpDir, "topics/budget.md"), "utf-8");
    expect(page).toContain("Budget reserve fund increased");
    expect(page).not.toContain("Animal shelter kennel expansion");
  });
});

describe("ingestDocument — unsupported formats", () => {
  it("returns skipped:true without calling the AI for an unsupported extension", async () => {
    const pngPath = path.join(docsDir, "scan.png");
    fs.writeFileSync(pngPath, "not really an image", "utf-8");
    const { ingestDocument } = await importEngine();

    const result = await ingestDocument(makeDoc({ localPath: "scan.png" }));

    expect(result.skipped).toBe(true);
    expect(result.success).toBe(false);
    expect(result.pagesCreated).toEqual([]);
    expect(mockComplete).not.toHaveBeenCalled();
  });
});
