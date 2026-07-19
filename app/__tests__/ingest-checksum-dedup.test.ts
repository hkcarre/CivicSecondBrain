/**
 * ingest-checksum-dedup.test.ts
 *
 * Verifies that the ingest route skips a document whose manifest entry
 * already contains a checksum matching the downloaded file.
 *
 * The test mocks the heavy I/O dependencies (discoverDocuments,
 * downloadDocument, ingestDocument, loadManifest) so it runs without
 * network access or a real filesystem manifest.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

// ─── helpers ──────────────────────────────────────────────────────────────

function md5(content: string): string {
  return crypto.createHash("md5").update(content).digest("hex");
}

// ─── mock modules before importing the route ──────────────────────────────

// We need to mock at the module level so the route picks up mocks.
// Vitest supports top-level vi.mock hoisting.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/scraper/schertz-scraper", () => ({
  discoverDocuments: vi.fn(),
  downloadDocument: vi.fn(),
  toCivicDocument: vi.fn(
    (doc: { url: string; title: string; type: string; date: string }, localPath: string, id: string) => ({
      id,
      title: doc.title,
      type: doc.type,
      date: doc.date,
      sourceUrl: doc.url,
      localPath,
    })
  ),
}));

vi.mock("@/lib/claude/ingest-engine", () => ({
  ingestDocument: vi.fn(),
}));

vi.mock("@/lib/manifest", async () => {
  // Re-use the real manifest helpers so we exercise the actual checksum logic.
  const real = await vi.importActual<typeof import("@/lib/manifest")>("@/lib/manifest");
  return {
    ...real,
    loadManifest: vi.fn(),
    saveManifest: vi.fn(),
  };
});

// ─── import after mocks ────────────────────────────────────────────────────

import { discoverDocuments, downloadDocument } from "@/lib/scraper/schertz-scraper";
import { ingestDocument } from "@/lib/claude/ingest-engine";
import { loadManifest, saveManifest, docId, fileChecksum } from "@/lib/manifest";
import { POST } from "@/api/ingest/route";

// ─── tests ────────────────────────────────────────────────────────────────

describe("ingest route – checksum dedup", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ingest-dedup-test-"));
    vi.clearAllMocks();
  });

  it("skips a document whose manifest checksum matches the downloaded file", async () => {
    const url = "https://www.schertz.com/DocumentCenter/View/1234/budget.pdf";
    const title = "FY2024 Budget";
    const fileContent = "budget content that has not changed";

    // Write a fake "downloaded" file
    const localPath = path.join(tmpDir, "fy2024-budget.pdf");
    fs.writeFileSync(localPath, fileContent, "utf-8");
    const cs = fileChecksum(localPath);

    // Pre-populate the manifest with the same checksum (doc was previously ingested)
    const id = docId(url);
    const existingManifest = {
      [id]: {
        id,
        title,
        type: "budget" as const,
        date: "2024-01-01",
        sourceUrl: url,
        ingestedAt: "2024-01-02T00:00:00Z",
        checksum: cs, // matches the current file
      },
    };

    // Wire mocks
    vi.mocked(discoverDocuments).mockResolvedValue([{ title, url, type: "budget", date: "2024-01-01" }]);
    vi.mocked(downloadDocument).mockResolvedValue(localPath);
    vi.mocked(loadManifest).mockReturnValue(existingManifest);

    // Call the route
    const req = new Request("http://localhost/api/ingest", {
      method: "POST",
      body: JSON.stringify({ limit: 10 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    // The document was downloaded but should have been skipped due to matching checksum.
    expect(downloadDocument).toHaveBeenCalledOnce();
    expect(ingestDocument).not.toHaveBeenCalled();
    // Note: the route saves the manifest once after the loop (race-condition fix #76),
    // so saveManifest may be called even when every document is skipped. The key
    // invariants are that the doc was never re-ingested and counts stay at zero.
    expect(json.processed).toBe(0);
    expect(json.succeeded).toBe(0);
  });

  it("processes a document when the manifest checksum differs (file changed)", async () => {
    const url = "https://www.schertz.com/DocumentCenter/View/5678/minutes.pdf";
    const title = "Meeting Minutes Jan 2024";
    const fileContent = "updated minutes content";

    const localPath = path.join(tmpDir, "meeting-minutes.pdf");
    fs.writeFileSync(localPath, fileContent, "utf-8");

    const id = docId(url);
    const existingManifest = {
      [id]: {
        id,
        title,
        type: "meeting-minutes" as const,
        date: "2024-01-15",
        sourceUrl: url,
        ingestedAt: "2024-01-16T00:00:00Z",
        checksum: "old-checksum-that-no-longer-matches",
      },
    };

    vi.mocked(discoverDocuments).mockResolvedValue([{ title, url, type: "meeting-minutes", date: "2024-01-15" }]);
    vi.mocked(downloadDocument).mockResolvedValue(localPath);
    vi.mocked(loadManifest).mockReturnValue(existingManifest);
    vi.mocked(ingestDocument).mockResolvedValue({ skipped: false } as Awaited<ReturnType<typeof ingestDocument>>);

    const req = new Request("http://localhost/api/ingest", {
      method: "POST",
      body: JSON.stringify({ limit: 10 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(downloadDocument).toHaveBeenCalledOnce();
    expect(ingestDocument).toHaveBeenCalledOnce();
    expect(saveManifest).toHaveBeenCalledOnce();
    expect(json.processed).toBe(1);
    expect(json.succeeded).toBe(1);
  });

  it("processes a document that has never been ingested before", async () => {
    const url = "https://www.schertz.com/DocumentCenter/View/9999/new-doc.pdf";
    const title = "New Document";
    const fileContent = "brand new content";

    const localPath = path.join(tmpDir, "new-document.pdf");
    fs.writeFileSync(localPath, fileContent, "utf-8");

    vi.mocked(discoverDocuments).mockResolvedValue([{ title, url, type: "budget", date: "2024-06-01" }]);
    vi.mocked(downloadDocument).mockResolvedValue(localPath);
    vi.mocked(loadManifest).mockReturnValue({}); // empty manifest – never ingested
    vi.mocked(ingestDocument).mockResolvedValue({ skipped: false } as Awaited<ReturnType<typeof ingestDocument>>);

    const req = new Request("http://localhost/api/ingest", {
      method: "POST",
      body: JSON.stringify({ limit: 10 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(downloadDocument).toHaveBeenCalledOnce();
    expect(ingestDocument).toHaveBeenCalledOnce();
    expect(json.processed).toBe(1);
    expect(json.succeeded).toBe(1);
  });
});
