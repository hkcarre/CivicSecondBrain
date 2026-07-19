/**
 * upload-route.test.ts
 *
 * Functional tests for POST /api/ingest/upload beyond the auth cases in
 * ingest-auth.test.ts (which run with secrets set). These run in dev-open
 * mode (no secrets) and mock only the ingest engine — file handling, size
 * caps, metadata extraction, and temp-file cleanup are exercised for real
 * against a temp RAW_SOURCES_PATH.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const mockIngestDocument = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/claude/ingest-engine", () => ({
  ingestDocument: mockIngestDocument,
}));

let rawDir: string;

async function importRoute() {
  vi.resetModules();
  return import("@/api/ingest/upload/route");
}

function makeUpload(
  fields: Record<string, string> = {},
  filename = "budget.txt",
  content: string | ArrayBuffer = "budget document text"
): Request {
  const fd = new FormData();
  fd.append("file", new File([content], filename));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request("http://localhost/api/ingest/upload", {
    method: "POST",
    body: fd,
  });
}

beforeEach(() => {
  rawDir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-route-test-"));
  process.env.RAW_SOURCES_PATH = rawDir;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.INGEST_SECRET;
  delete process.env.MAX_FILE_SIZE_MB;
  mockIngestDocument.mockReset();
  mockIngestDocument.mockResolvedValue({
    success: true,
    pagesUpdated: ["topics/budget.md"],
    pagesCreated: [],
    keyFacts: "",
    ordinancesReferenced: [],
    dollarAmounts: [],
    votesRecorded: 0,
  });
});

afterEach(() => {
  fs.rmSync(rawDir, { recursive: true, force: true });
  delete process.env.RAW_SOURCES_PATH;
  delete process.env.MAX_FILE_SIZE_MB;
});

describe("POST /api/ingest/upload — success path", () => {
  it("ingests the file and reports pages, using provided metadata", async () => {
    const { POST } = await importRoute();
    const res = await POST(
      makeUpload({ title: "FY2027 Budget", type: "budget", board: "city-council", date: "2026-07-01" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("FY2027 Budget");
    expect(body.pagesUpdated).toEqual(["topics/budget.md"]);

    const doc = mockIngestDocument.mock.calls[0][0];
    expect(doc.title).toBe("FY2027 Budget");
    expect(doc.type).toBe("budget");
    expect(doc.board).toBe("city-council");
    expect(doc.date).toBe("2026-07-01");
    expect(doc.sourceUrl).toBe("local://budget.txt");
  });

  it("defaults the title to the filename stem and infers the type", async () => {
    const { POST } = await importRoute();
    const res = await POST(makeUpload({}, "adopted-budget_fy2026.txt"));
    expect(res.status).toBe(200);
    const doc = mockIngestDocument.mock.calls[0][0];
    expect(doc.title).toBe("adopted budget fy2026"); // stem, separators normalized
    expect(doc.type).toBe("budget"); // inferred from title
  });

  it("deletes the temp file after a successful ingest", async () => {
    const { POST } = await importRoute();
    await POST(makeUpload());
    expect(fs.readdirSync(rawDir)).toEqual([]);
  });
});

describe("POST /api/ingest/upload — failure handling", () => {
  it("returns 500 with the engine error message and still deletes the temp file", async () => {
    mockIngestDocument.mockRejectedValue(new Error("Claude API overloaded"));
    const { POST } = await importRoute();
    const res = await POST(makeUpload());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toContain("Claude API overloaded");
    expect(fs.readdirSync(rawDir)).toEqual([]); // finally-block cleanup
  });

  it("returns 400 when no file field is present", async () => {
    const { POST } = await importRoute();
    const fd = new FormData();
    fd.append("title", "no file here");
    const res = await POST(
      new Request("http://localhost/api/ingest/upload", { method: "POST", body: fd })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/no file/i);
  });
});

describe("POST /api/ingest/upload — size cap", () => {
  it("rejects files over MAX_FILE_SIZE_MB with 413 before ingesting", async () => {
    process.env.MAX_FILE_SIZE_MB = "1";
    const { POST } = await importRoute();
    const big = new ArrayBuffer(1.5 * 1024 * 1024); // 1.5MB > 1MB cap
    const res = await POST(makeUpload({}, "big.txt", big));
    expect(res.status).toBe(413);
    expect((await res.json()).message).toMatch(/too large/i);
    expect(mockIngestDocument).not.toHaveBeenCalled();
    expect(fs.readdirSync(rawDir)).toEqual([]); // never written
  });

  it("falls back to the 25MB default when MAX_FILE_SIZE_MB is not a number", async () => {
    // A misconfigured env var must not silently DISABLE the size cap.
    process.env.MAX_FILE_SIZE_MB = "not-a-number";
    const { POST } = await importRoute();
    const big = new ArrayBuffer(26 * 1024 * 1024); // 26MB > 25MB default
    const res = await POST(makeUpload({}, "big.txt", big));
    expect(res.status).toBe(413);
    expect(mockIngestDocument).not.toHaveBeenCalled();
  });
});
