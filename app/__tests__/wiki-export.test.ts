/**
 * wiki-export.test.ts
 *
 * Tests for GET /api/export/wiki
 * Covers: empty wiki, markdown export shape, ZIP export validity,
 * format fallback, and 404 on empty wiki.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let tmpDir: string;

// Re-import after resetting WIKI_PATH env so module-level const picks it up
async function importRoute() {
  vi.resetModules();
  return import("@/api/export/wiki/route");
}

function writeWikiFile(relPath: string, content: string) {
  const full = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf-8");
}

function makeGet(format?: string) {
  const url = format
    ? `http://localhost/api/export/wiki?format=${format}`
    : "http://localhost/api/export/wiki";
  return new Request(url, { method: "GET" });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-export-test-"));
  process.env.WIKI_PATH = tmpDir;
  // Keep the route in open dev mode — auth behavior is covered in export-auth.test.ts
  delete process.env.ADMIN_PASSWORD;
  delete process.env.INGEST_SECRET;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.WIKI_PATH;
});

describe("GET /api/export/wiki", () => {
  it("returns 404 when wiki is empty", async () => {
    const { GET } = await importRoute();
    const res = await GET(makeGet() as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/empty/i);
  });

  it("returns markdown file with correct content-type by default", async () => {
    writeWikiFile("topics/budget.md", `---\ntitle: Budget\ncategory: topic\n---\n\nBudget content.`);
    const { GET } = await importRoute();
    const res = await GET(makeGet() as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    expect(res.headers.get("content-disposition")).toMatch(/\.md"/);
    const text = await res.text();
    expect(text).toContain("Budget");
    expect(text).toContain("Budget content.");
  });

  it("returns markdown when format=md is explicit", async () => {
    writeWikiFile("topics/budget.md", `---\ntitle: Budget\ncategory: topic\n---\n\nContent.`);
    const { GET } = await importRoute();
    const res = await GET(makeGet("md") as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
  });

  it("includes all wiki files in markdown export", async () => {
    writeWikiFile("topics/budget.md", `---\ntitle: Budget\ncategory: topic\n---\n\nBudget info.`);
    writeWikiFile("decisions/2024-01-01-council.md", `---\ntitle: Jan Council\ncategory: decision\n---\n\nVoted yes.`);
    const { GET } = await importRoute();
    const res = await GET(makeGet("md") as any);
    const text = await res.text();
    expect(text).toContain("Budget info.");
    expect(text).toContain("Voted yes.");
  });

  it("returns ZIP with correct content-type when format=zip", async () => {
    writeWikiFile("topics/budget.md", `---\ntitle: Budget\ncategory: topic\n---\n\nContent.`);
    const { GET } = await importRoute();
    const res = await GET(makeGet("zip") as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toMatch(/\.zip"/);
  });

  it("ZIP has valid PKZIP signature (PK magic bytes)", async () => {
    writeWikiFile("topics/budget.md", `---\ntitle: Budget\ncategory: topic\n---\n\nContent.`);
    const { GET } = await importRoute();
    const res = await GET(makeGet("zip") as any);
    const buf = Buffer.from(await res.arrayBuffer());
    // PK local file header signature: 0x50 0x4B 0x03 0x04
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it("ZIP end-of-central-directory signature present", async () => {
    writeWikiFile("topics/budget.md", `---\ntitle: Budget\ncategory: topic\n---\n\nContent.`);
    const { GET } = await importRoute();
    const res = await GET(makeGet("zip") as any);
    const buf = Buffer.from(await res.arrayBuffer());
    // EOCD signature at end: 0x50 0x4B 0x05 0x06
    const eocdIdx = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    expect(eocdIdx).toBeGreaterThan(0);
  });

  it("markdown export groups pages by category heading", async () => {
    writeWikiFile("topics/budget.md", `---\ntitle: Budget\ncategory: topic\n---\n\nBudget info.`);
    writeWikiFile("decisions/2024-01-01.md", `---\ntitle: Jan Decision\ncategory: decision\n---\n\nDecision text.`);
    const { GET } = await importRoute();
    const res = await GET(makeGet("md") as any);
    const text = await res.text();
    expect(text).toMatch(/## Topics/);
    expect(text).toMatch(/## Decisions/);
    // Topics section should appear before Decisions
    expect(text.indexOf("## Topics")).toBeLessThan(text.indexOf("## Decisions"));
  });
});
