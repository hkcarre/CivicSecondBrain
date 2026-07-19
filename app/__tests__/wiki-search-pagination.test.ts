/**
 * wiki-search-pagination.test.ts
 *
 * Endpoint-level tests for GET /api/wiki/search pagination:
 * default limit, custom limit/offset, hard cap at 200, total count,
 * offset past the end, and relevance-sorted page 1.
 *
 * Uses the repo pattern: temp-dir WIKI_PATH + vi.resetModules() + dynamic
 * imports so module-level WIKI_PATH constants pick up the env var.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let tmpDir: string;

// Re-import after resetting modules so WIKI_PATH picks up the new env var
async function importRoute() {
  vi.resetModules();
  return import("../api/wiki/search/route");
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-search-test-"));
  process.env.WIKI_PATH = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.WIKI_PATH;
});

function writePage(relPath: string, title: string, content: string, category = "topic") {
  const full = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(
    full,
    `---
title: "${title}"
type: wiki
category: ${category}
sources:
  - test.pdf
last_updated: "2024-10-01"
---

${content}
`,
    "utf-8"
  );
}

async function search(query: string) {
  const { GET } = await importRoute();
  const { NextRequest } = await import("next/server");
  const req = new NextRequest(`http://localhost/api/wiki/search?${query}`);
  const res = await GET(req);
  return { status: res.status, body: await res.json() };
}

describe("GET /api/wiki/search pagination", () => {
  it("applies the default limit of 50", async () => {
    for (let i = 0; i < 60; i++) {
      writePage(`topics/page-${String(i).padStart(2, "0")}.md`, `Page ${i}`, "budget details");
    }
    const { status, body } = await search("q=budget");
    expect(status).toBe(200);
    expect(body.results).toHaveLength(50);
    expect(body.total).toBe(60);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
  });

  it("respects custom limit and offset applied after relevance sorting", async () => {
    // Page i contains the term (10 - i) times → relevance order is p0..p9
    for (let i = 0; i < 10; i++) {
      writePage(`topics/p${i}.md`, `Topic ${i}`, Array(10 - i).fill("water").join(" "));
    }
    const { body } = await search("q=water&limit=3&offset=3");
    expect(body.results.map((r: { path: string }) => r.path)).toEqual([
      "topics/p3.md",
      "topics/p4.md",
      "topics/p5.md",
    ]);
    expect(body.total).toBe(10);
    expect(body.limit).toBe(3);
    expect(body.offset).toBe(3);
  });

  it("clamps limit to the hard cap of 200 without erroring", async () => {
    writePage("topics/one.md", "One", "budget");
    const { status, body } = await search("q=budget&limit=9999");
    expect(status).toBe(200);
    expect(body.limit).toBe(200);
    expect(body.results).toHaveLength(1);
  });

  it("falls back to the default for invalid or negative limit values", async () => {
    writePage("topics/one.md", "One", "budget");
    expect((await search("q=budget&limit=abc")).body.limit).toBe(50);
    expect((await search("q=budget&limit=-5")).body.limit).toBe(50);
    expect((await search("q=budget&offset=-3")).body.offset).toBe(0);
  });

  it("reports total as the full match count before pagination", async () => {
    for (let i = 0; i < 12; i++) {
      writePage(`topics/t${i}.md`, `T ${i}`, "sewer maintenance");
    }
    writePage("topics/other.md", "Other", "unrelated content");
    const { body } = await search("q=sewer&limit=5");
    expect(body.results).toHaveLength(5);
    expect(body.total).toBe(12);
  });

  it("returns empty results when offset is beyond the end", async () => {
    for (let i = 0; i < 3; i++) {
      writePage(`topics/t${i}.md`, `T ${i}`, "parks info");
    }
    const { status, body } = await search("q=parks&offset=100");
    expect(status).toBe(200);
    expect(body.results).toEqual([]);
    expect(body.total).toBe(3);
  });

  it("puts the most relevant match on page 1 regardless of file order", async () => {
    // "aa-" sorts first on disk but is the weaker match
    writePage("topics/aa-weak.md", "Misc", "zoning");
    writePage("topics/zz-strong.md", "Zoning Code", "zoning zoning zoning");
    const { body } = await search("q=zoning&limit=1");
    expect(body.results).toHaveLength(1);
    expect(body.results[0].path).toBe("topics/zz-strong.md");
    expect(body.total).toBe(2);
  });

  it("paginates within a category filter", async () => {
    writePage("topics/t1.md", "Topic", "vote records", "topic");
    writePage("decisions/d1.md", "Decision One", "vote", "decision");
    writePage("decisions/d2.md", "Decision Two", "vote", "decision");
    const { body } = await search("q=vote&category=decision&limit=1");
    expect(body.total).toBe(2);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].category).toBe("decision");
  });
});
