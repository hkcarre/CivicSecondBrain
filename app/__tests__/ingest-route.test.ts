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
