/**
 * Tests for POST /api/ingest — failure tracking, log writing, and response shape.
 *
 * Strategy: mock the heavy external dependencies (scraper, ingest-engine, manifest,
 * appendToLog) so we can exercise the route's error-handling logic without touching
 * the filesystem or the Anthropic API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks ──────────────────────────────────────────────────────────────

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: object = {}): Request {
  return new Request("http://localhost/api/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/ingest — failure tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty failures when all documents succeed", async () => {
    const { discoverDocuments, downloadDocument, toCivicDocument } =
      await import("@/lib/scraper/schertz-scraper");
    const { ingestDocument } = await import("@/lib/claude/ingest-engine");

    vi.mocked(discoverDocuments).mockResolvedValue([
      { url: "http://example.com/doc1.pdf", title: "Doc 1" },
    ] as any);
    vi.mocked(downloadDocument).mockResolvedValue("/tmp/doc1.pdf");
    vi.mocked(toCivicDocument).mockReturnValue({ id: "doc1" } as any);
    vi.mocked(ingestDocument).mockResolvedValue(undefined);

    // Re-import route after mocks are set up
    vi.resetModules();
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
    const { appendToLog } = await import("@/lib/wiki/writer");

    vi.mocked(discoverDocuments).mockResolvedValue([
      { url: "http://example.com/fail.pdf", title: "Failing Doc" },
    ] as any);
    vi.mocked(downloadDocument).mockResolvedValue("/tmp/fail.pdf");
    vi.mocked(toCivicDocument).mockReturnValue({ id: "fail" } as any);
    vi.mocked(ingestDocument).mockRejectedValue(new Error("Claude API error"));

    vi.resetModules();
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

    vi.resetModules();
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

    vi.resetModules();
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

    vi.resetModules();
    const { POST } = await import("@/api/ingest/route");

    const res = await POST(makeRequest({ limit: 5 }));

    // Per-doc failures are tracked, not bubbled as 500
    expect(res.status).toBe(200);
  });

  it("returns message: No pending documents when none are pending", async () => {
    vi.resetModules();

    const { discoverDocuments } = await import(
      "@/lib/scraper/schertz-scraper"
    );

    vi.mocked(discoverDocuments).mockResolvedValue([]);

    const { needsIngestion } = await import("@/lib/manifest");
    vi.mocked(needsIngestion).mockReturnValue(false);

    vi.resetModules();
    const { POST } = await import("@/api/ingest/route");

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(data.message).toContain("No pending");
  });
});
