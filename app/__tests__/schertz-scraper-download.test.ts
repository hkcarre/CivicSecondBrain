import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// We test the security properties of downloadDocument in isolation.
// The network call (axios) is mocked so tests are fast and offline.

// vi.mock calls must be at module top level (nested calls are deprecated and
// will become an error in a future Vitest version). Registrations survive
// vi.resetModules(); per-test behavior is applied in importDownloadDocument.
vi.mock("axios");
vi.mock("../lib/scraper/laserfiche-scraper", () => ({
  discoverLaserficheDocs: vi.fn().mockResolvedValue([]),
}));

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scraper-test-"));
  process.env.RAW_SOURCES_PATH = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.RAW_SOURCES_PATH;
  vi.resetModules();
});

async function importDownloadDocument() {
  vi.resetModules();
  const axiosMod = await import("axios");
  const axiosMock = axiosMod.default as unknown as { head: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
  // HEAD: pretend server doesn't support it
  axiosMock.head = vi.fn().mockRejectedValue(new Error("not supported"));
  // GET: return minimal PDF buffer
  const fakeData = Buffer.from("%PDF-fake");
  axiosMock.get = vi.fn().mockResolvedValue({
    data: fakeData,
    headers: { "content-type": "application/pdf" },
  });

  const { downloadDocument } = await import("../lib/scraper/schertz-scraper");
  return { downloadDocument, axiosMock };
}

describe("downloadDocument — path jailing", () => {
  it("writes to a hashed filename (not title-derived)", async () => {
    const { downloadDocument } = await importDownloadDocument();
    const doc = {
      title: "../../etc/passwd injection title",
      url: "https://www.schertz.com/DocumentCenter/View/1234/doc.pdf",
      type: "budget" as const,
    };
    const localPath = await downloadDocument(doc);
    expect(localPath).not.toBeNull();
    // Should NOT contain the sanitized title
    expect(localPath).not.toMatch(/passwd/i);
    expect(localPath).not.toMatch(/injection/i);
    // Should be a hex-based name (12 hex chars from docId)
    const basename = path.basename(localPath!);
    expect(basename).toMatch(/^[a-f0-9]{12}\.pdf$/);
  });

  it("stays inside RAW_SOURCES_PATH", async () => {
    const { downloadDocument } = await importDownloadDocument();
    const doc = {
      title: "normal document",
      url: "https://www.schertz.com/DocumentCenter/View/5678/budget.pdf",
      type: "budget" as const,
    };
    const localPath = await downloadDocument(doc);
    expect(localPath).not.toBeNull();
    expect(path.resolve(localPath!).startsWith(path.resolve(tmpDir))).toBe(true);
  });

  it("extracts extension from URL pathname, not raw URL string", async () => {
    const { downloadDocument } = await importDownloadDocument();
    // URL with query params that include ../ — should not affect the extension
    const doc = {
      title: "tricky doc",
      url: "https://www.schertz.com/doc.pdf?foo=../../bar",
      type: "agenda" as const,
    };
    const localPath = await downloadDocument(doc);
    expect(localPath).not.toBeNull();
    // Extension should still be .pdf from content-type
    expect(localPath!.endsWith(".pdf")).toBe(true);
  });
});
