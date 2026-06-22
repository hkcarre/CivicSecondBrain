/**
 * Tests for POST /api/ingest
 *
 * Covers:
 *  - failure tracking, [ERROR] log writing, and response shape (from #87)
 *  - saveManifest called exactly once after the loop, not per-document (race fix, #76)
 *  - 409 returned when an ingest is already in progress (concurrency mutex, #76)
 *
 * Strategy: mock the heavy external dependencies (scraper, ingest-engine, manifest,
 * appendToLog) so we exercise the route's control flow without touching the
 * filesystem or the Anthropic API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CivicDocument, IngestResult } from "@/types";

// ─── Module mocks ────────────────────────────────────────────────────────────

vi.mock("@/lib/scraper/schertz-scraper", () => ({
  discoverDocuments: vi.fn(),
  downloadDocument: vi.fn(),
  toCivicDocument: vi.fn(),
}));

vi.mock("@/lib/claude/ingest-engine", () => ({
  ingestDocument: vi.fn(),
}));

vi.mock("@/lib/manifest", () => ({
  loadManifest: vi.fn(() => ({})),
  saveManifest: vi.fn(),
  docId: vi.fn((url: string) => url),
  needsIngestion: vi.fn(() => true),
  markIngested: vi.fn(),
}));

vi.mock("@/lib/wiki/writer", () => ({
  appendToLog: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: object = {}): Request {
  return new Request("http://localhost/api/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/ingest — failure tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty failures when all documents succeed", async () => {
    vi.resetModules();

    const { discoverDocuments, downloadDocument, toCivicDocument } =
      await import("@/lib/scraper/schertz-scraper");
    const { ingestDocument } = await import("@/lib/claude/ingest-engine");

    vi.mocked(discoverDocuments).mockResolvedValue([
      { url: "http://example.com/doc1.pdf", title: "Doc 1" },
    ] as any);
    vi.mocked(downloadDocument).mockResolvedValue("/tmp/doc1.pdf");
    vi.mocked(toCivicDocument).mockReturnValue({ id: "doc1" } as any);
    vi.mocked(ingestDocument).mockResolvedValue({ skipped: false } as any);

    const { POST } = await import("@/api/ingest/route");

    const res = await POST(makeRequest({ limit: 5 }));
    const data = await res.json();

    expect(data.failed).toBe(0);
    expect(data.failedDocuments).toEqual([]);
    expect(data.succeeded).toBe(1);
    expect(data.processed).toBe(1);
  });

  it("tracks failure title when ingestDocument throws", async () => {
    vi.resetModules();

    const { discoverDocuments, downloadDocument, toCivicDocument } =
      await import("@/lib/scraper/schertz-scraper");
    const { ingestDocument } = await import("@/lib/claude/ingest-engine");

    vi.mocked(discoverDocuments).mockResolvedValue([
      { url: "http://example.com/fail.pdf", title: "Failing Doc" },
    ] as any);
    vi.mocked(downloadDocument).mockResolvedValue("/tmp/fail.pdf");
    vi.mocked(toCivicDocument).mockReturnValue({ id: "fail" } as any);
    vi.mocked(ingestDocument).mockRejectedValue(new Error("Claude API error"));

    const { POST } = await import("@/api/ingest/route");

    const res = await POST(makeRequest({ limit: 5 }));
    const data = await res.json();

    expect(data.failed).toBe(1);
    expect(data.failedDocuments).toEqual(["Failing Doc"]);
    expect(data.succeeded).toBe(0);
    expect(data.processed).toBe(1);
  });

  it("calls appendToLog with [ERROR] prefix on ingest failure", async () => {
    vi.resetModules();

    const { discoverDocuments, downloadDocument, toCivicDocument } =
      await import("@/lib/scraper/schertz-scraper");
    const { ingestDocument } = await import("@/lib/claude/ingest-engine");
    const { appendToLog } = await import("@/lib/wiki/writer");

    vi.mocked(discoverDocuments).mockResolvedValue([
      { url: "http://example.com/bad.pdf", title: "Bad Document" },
    ] as any);
    vi.mocked(downloadDocument).mockResolvedValue("/tmp/bad.pdf");
    vi.mocked(toCivicDocument).mockReturnValue({ id: "bad" } as any);
    vi.mocked(ingestDocument).mockRejectedValue(new Error("timeout"));

    const { POST } = await import("@/api/ingest/route");

    await POST(makeRequest({ limit: 5 }));

    expect(vi.mocked(appendToLog)).toHaveBeenCalledOnce();
    const logArg: string = vi.mocked(appendToLog).mock.calls[0][0];
    expect(logArg).toContain("[ERROR]");
    expect(logArg).toContain("Bad Document");
    expect(logArg).toContain("timeout");
  });

  it("tracks multiple failures when multiple docs fail", async () => {
    vi.resetModules();

    const { discoverDocuments, downloadDocument, toCivicDocument } =
      await import("@/lib/scraper/schertz-scraper");
    const { ingestDocument } = await import("@/lib/claude/ingest-engine");

    vi.mocked(discoverDocuments).mockResolvedValue([
      { url: "http://example.com/a.pdf", title: "Doc A" },
      { url: "http://example.com/b.pdf", title: "Doc B" },
    ] as any);
    vi.mocked(downloadDocument).mockResolvedValue("/tmp/doc.pdf");
    vi.mocked(toCivicDocument).mockReturnValue({ id: "x" } as any);
    vi.mocked(ingestDocument).mockRejectedValue(new Error("network error"));

    const { POST } = await import("@/api/ingest/route");

    const res = await POST(makeRequest({ limit: 10 }));
    const data = await res.json();

    expect(data.failed).toBe(2);
    expect(data.failedDocuments).toEqual(["Doc A", "Doc B"]);
    expect(data.succeeded).toBe(0);
    expect(data.processed).toBe(2);
  });

  it("returns 200 with failure details rather than 500 on per-doc errors", async () => {
    vi.resetModules();

    const { discoverDocuments, downloadDocument, toCivicDocument } =
      await import("@/lib/scraper/schertz-scraper");
    const { ingestDocument } = await import("@/lib/claude/ingest-engine");

    vi.mocked(discoverDocuments).mockResolvedValue([
      { url: "http://example.com/x.pdf", title: "X" },
    ] as any);
    vi.mocked(downloadDocument).mockResolvedValue("/tmp/x.pdf");
    vi.mocked(toCivicDocument).mockReturnValue({ id: "x" } as any);
    vi.mocked(ingestDocument).mockRejectedValue(new Error("API failure"));

    const { POST } = await import("@/api/ingest/route");

    const res = await POST(makeRequest({ limit: 5 }));

    expect(res.status).toBe(200);
  });

  it("returns message: No pending documents when none are pending", async () => {
    vi.resetModules();

    const { discoverDocuments } = await import("@/lib/scraper/schertz-scraper");

    vi.mocked(discoverDocuments).mockResolvedValue([]);

    const { needsIngestion } = await import("@/lib/manifest");
    vi.mocked(needsIngestion).mockReturnValue(false);

    const { POST } = await import("@/api/ingest/route");

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(data.message).toContain("No pending");
  });
});

describe("POST /api/ingest — manifest persistence & concurrency (#76)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // clearAllMocks keeps implementations; ensure dedup gate is open for these tests
    const { needsIngestion } = await import("@/lib/manifest");
    vi.mocked(needsIngestion).mockReturnValue(true);
  });

  it("saves manifest exactly once after all documents are processed", async () => {
    vi.resetModules();

    const { discoverDocuments, downloadDocument, toCivicDocument } =
      await import("@/lib/scraper/schertz-scraper");
    const { ingestDocument } = await import("@/lib/claude/ingest-engine");
    const { saveManifest } = await import("@/lib/manifest");

    vi.mocked(discoverDocuments).mockResolvedValue([
      { url: "http://example.com/doc1.pdf", title: "Doc 1" },
      { url: "http://example.com/doc2.pdf", title: "Doc 2" },
      { url: "http://example.com/doc3.pdf", title: "Doc 3" },
    ] as any);
    vi.mocked(downloadDocument).mockImplementation(
      async (d: any) => `/tmp/${d.url.slice(-8)}`
    );
    vi.mocked(toCivicDocument).mockImplementation(
      (_d: any, _p: any, id: any) => ({ id }) as any
    );
    vi.mocked(ingestDocument).mockResolvedValue({ skipped: false } as any);

    const { POST } = await import("@/api/ingest/route");

    const res = await POST(makeRequest({ limit: 10 }));
    expect(res.status).toBe(200);

    // Core assertion: only ONE save regardless of document count
    expect(vi.mocked(saveManifest)).toHaveBeenCalledTimes(1);
  });

  it("saveManifest receives the same manifest object mutated by markIngested", async () => {
    vi.resetModules();

    const { discoverDocuments, downloadDocument, toCivicDocument } =
      await import("@/lib/scraper/schertz-scraper");
    const { ingestDocument } = await import("@/lib/claude/ingest-engine");
    const { loadManifest, saveManifest } = await import("@/lib/manifest");

    const capturedManifest = {};
    vi.mocked(loadManifest).mockReturnValue(capturedManifest);
    let savedArg: unknown;
    vi.mocked(saveManifest).mockImplementation((m: unknown) => {
      savedArg = m;
    });

    vi.mocked(discoverDocuments).mockResolvedValue([
      { url: "http://example.com/doc1.pdf", title: "Doc 1" },
      { url: "http://example.com/doc2.pdf", title: "Doc 2" },
    ] as any);
    vi.mocked(downloadDocument).mockResolvedValue("/tmp/file");
    vi.mocked(toCivicDocument).mockReturnValue({ id: "id1" } as any);
    vi.mocked(ingestDocument).mockResolvedValue({ skipped: false } as any);

    const { POST } = await import("@/api/ingest/route");

    await POST(makeRequest({ limit: 10 }));

    expect(savedArg).toBe(capturedManifest);
  });

  it("returns 409 when a second request arrives while the first is in flight", async () => {
    vi.resetModules();

    const { discoverDocuments, downloadDocument, toCivicDocument } =
      await import("@/lib/scraper/schertz-scraper");
    const { ingestDocument } = await import("@/lib/claude/ingest-engine");

    // First request: ingest hangs until we resolve it.
    let resolveIngest!: (v: unknown) => void;
    const ingestHanging = new Promise((res) => {
      resolveIngest = res;
    });
    vi.mocked(ingestDocument).mockReturnValueOnce(ingestHanging as any);

    vi.mocked(discoverDocuments).mockResolvedValue([
      { url: "http://example.com/doc1.pdf", title: "Doc 1" },
    ] as any);
    vi.mocked(downloadDocument).mockResolvedValue("/tmp/doc1.pdf");
    vi.mocked(toCivicDocument).mockReturnValue({ id: "id1" } as any);

    // Import once so both requests share the module-level in-progress flag.
    const { POST } = await import("@/api/ingest/route");

    const p1 = POST(makeRequest({}));
    // Give req1 a tick to set ingestInProgress = true
    await new Promise((r) => setImmediate(r));
    const res2 = await POST(makeRequest({}));

    expect(res2.status).toBe(409);
    const body2 = await res2.json();
    expect(body2.message).toMatch(/in progress/i);

    // Clean up the hanging first request
    resolveIngest({ skipped: false });
    await p1;
  });

  it("response includes failed count when a download fails", async () => {
    vi.resetModules();

    const { discoverDocuments, downloadDocument, toCivicDocument } =
      await import("@/lib/scraper/schertz-scraper");
    const { ingestDocument } = await import("@/lib/claude/ingest-engine");

    vi.mocked(discoverDocuments).mockResolvedValue([
      { url: "http://example.com/doc1.pdf", title: "Doc 1" },
      { url: "http://example.com/doc2.pdf", title: "Doc 2" },
    ] as any);
    // doc2 download fails (returns falsy)
    vi.mocked(downloadDocument).mockImplementation(async (d: any) =>
      d.url.includes("doc2") ? (null as any) : "/tmp/file"
    );
    vi.mocked(toCivicDocument).mockReturnValue({ id: "id1" } as any);
    vi.mocked(ingestDocument).mockResolvedValue({ skipped: false } as any);

    const { POST } = await import("@/api/ingest/route");

    const res = await POST(makeRequest({ limit: 10 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("failed");
    expect(body.failed).toBeGreaterThanOrEqual(1);
    expect(body.failedDocuments).toContain("Doc 2");
  });
});

describe("POST /api/ingest/document — manual single-document ingest", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    delete process.env.INGEST_SECRET;
    const { needsIngestion } = await import("@/lib/manifest");
    vi.mocked(needsIngestion).mockReturnValue(true);
  });

  it("requires INGEST_SECRET auth for manual requests when configured", async () => {
    vi.resetModules();
    process.env.INGEST_SECRET = "test-secret";

    const { POST } = await import("@/api/ingest/document/route");

    const res = await POST(makeRequest({ url: "https://example.com/doc.pdf" }));

    expect(res.status).toBe(401);
    delete process.env.INGEST_SECRET;
  });

  it("rejects empty, malformed, and non-http URLs with 400", async () => {
    for (const url of ["", "not a url", "ftp://example.com/doc.pdf"]) {
      vi.resetModules();
      const { discoverDocuments } = await import("@/lib/scraper/schertz-scraper");
      const { POST } = await import("@/api/ingest/document/route");

      const res = await POST(makeRequest({ url }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.message).toMatch(/url/i);
      expect(vi.mocked(discoverDocuments)).not.toHaveBeenCalled();
    }
  });

  it("ingests one provided document without running discovery", async () => {
    vi.resetModules();

    const {
      discoverDocuments,
      downloadDocument,
      toCivicDocument,
    } = await import("@/lib/scraper/schertz-scraper");
    const { ingestDocument } = await import("@/lib/claude/ingest-engine");
    const { saveManifest, markIngested } = await import("@/lib/manifest");

    const civicDoc: CivicDocument = {
      id: "doc-1",
      title: "Manual Notice",
      type: "public-notice",
      board: "city-council",
      date: "2026-06-20",
      sourceUrl: "https://example.com/notice.pdf",
      localPath: "/tmp/notice.pdf",
    };
    vi.mocked(downloadDocument).mockResolvedValue("/tmp/notice.pdf");
    vi.mocked(toCivicDocument).mockReturnValue(civicDoc);
    const ingestResult: IngestResult = {
      success: true,
      document: civicDoc,
      pagesUpdated: ["topics/budget.md"],
      pagesCreated: ["topics/notice.md"],
      keyFacts: "",
      ordinancesReferenced: [],
      dollarAmounts: [],
      votesRecorded: 0,
    };
    vi.mocked(ingestDocument).mockResolvedValue(ingestResult);

    const { POST } = await import("@/api/ingest/document/route");

    const res = await POST(
      makeRequest({
        url: "https://example.com/notice.pdf",
        title: "Manual Notice",
        type: "public-notice",
        board: "city-council",
        date: "2026-06-20",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(vi.mocked(discoverDocuments)).not.toHaveBeenCalled();
    expect(vi.mocked(downloadDocument)).toHaveBeenCalledWith({
      url: "https://example.com/notice.pdf",
      title: "Manual Notice",
      type: "public-notice",
      board: "city-council",
      date: "2026-06-20",
    });
    expect(vi.mocked(ingestDocument)).toHaveBeenCalledWith(civicDoc);
    expect(vi.mocked(markIngested)).toHaveBeenCalledOnce();
    expect(vi.mocked(saveManifest)).toHaveBeenCalledOnce();
    expect(data).toMatchObject({
      success: true,
      message: "Document ingested successfully.",
      pagesUpdated: ["topics/budget.md"],
      pagesCreated: ["topics/notice.md"],
    });
    expect(data.document).toEqual(civicDoc);
  });

  it("does not save the manifest when manual ingest is skipped as unsupported", async () => {
    vi.resetModules();

    const { downloadDocument, toCivicDocument } = await import(
      "@/lib/scraper/schertz-scraper"
    );
    const { ingestDocument } = await import("@/lib/claude/ingest-engine");
    const { saveManifest, markIngested } = await import("@/lib/manifest");

    const civicDoc: CivicDocument = {
      id: "doc-xlsx",
      title: "Spreadsheet",
      type: "financial-report",
      date: "2026-06-21",
      sourceUrl: "https://example.com/report.xlsx",
      localPath: "/tmp/report.xlsx",
    };
    vi.mocked(downloadDocument).mockResolvedValue("/tmp/report.xlsx");
    vi.mocked(toCivicDocument).mockReturnValue(civicDoc);
    const ingestResult: IngestResult = {
      success: false,
      document: civicDoc,
      pagesUpdated: [],
      pagesCreated: [],
      keyFacts: "",
      ordinancesReferenced: [],
      dollarAmounts: [],
      votesRecorded: 0,
      skipped: true,
    };
    vi.mocked(ingestDocument).mockResolvedValue(ingestResult);

    const { POST } = await import("@/api/ingest/document/route");

    const res = await POST(makeRequest({ url: "https://example.com/report.xlsx" }));
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.success).toBe(false);
    expect(data.message).toMatch(/unsupported/i);
    expect(vi.mocked(markIngested)).not.toHaveBeenCalled();
    expect(vi.mocked(saveManifest)).not.toHaveBeenCalled();
  });

  it("returns a clean error and leaves manifest untouched when manual ingest fails", async () => {
    vi.resetModules();

    const { downloadDocument, toCivicDocument } = await import(
      "@/lib/scraper/schertz-scraper"
    );
    const { ingestDocument } = await import("@/lib/claude/ingest-engine");
    const { saveManifest } = await import("@/lib/manifest");

    vi.mocked(downloadDocument).mockResolvedValue("/tmp/fail.pdf");
    vi.mocked(toCivicDocument).mockReturnValue({
      id: "fail",
      title: "Fail",
      type: "public-notice",
      date: "2026-06-21",
      sourceUrl: "https://example.com/fail.pdf",
      localPath: "/tmp/fail.pdf",
    });
    vi.mocked(ingestDocument).mockRejectedValue(new Error("AI provider failed"));

    const { POST } = await import("@/api/ingest/document/route");

    const res = await POST(makeRequest({ url: "https://example.com/fail.pdf" }));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.message).toContain("AI provider failed");
    expect(vi.mocked(saveManifest)).not.toHaveBeenCalled();
  });
});
