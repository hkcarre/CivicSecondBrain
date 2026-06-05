import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let tmpDir: string;

async function importWriter() {
  vi.resetModules();
  return import("../lib/wiki/writer");
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-writer-new-"));
  process.env.WIKI_PATH = tmpDir;
  // Create queries dir
  fs.mkdirSync(path.join(tmpDir, "queries"), { recursive: true });
  // Stub index.md
  fs.writeFileSync(
    path.join(tmpDir, "index.md"),
    `---\ncity: Test\n---\n\nLast updated: 2024-01-01\n\nPages: 0\n\n## Topics\n\n## Decisions\n\n## People & Boards\n\n## Recommendations\n\n## Queries Filed\n`,
    "utf-8"
  );
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.WIKI_PATH;
});

// ─── writeQueryPage ────────────────────────────────────────────────────────

describe("writeQueryPage", () => {
  it("creates a file in queries/ with correct frontmatter", async () => {
    const { writeQueryPage } = await importWriter();
    const message = {
      content:
        "The FY2024 general fund was $42M [SOURCE: budget-fy2024.pdf, p.3].",
    };
    const { path: queryPath, title } = writeQueryPage(message, "2024-10-01");

    expect(queryPath).toMatch(/^queries\/2024-10-01-/);
    expect(queryPath).toMatch(/\.md$/);
    expect(title).toMatch(/Q&A/);

    const fullPath = path.join(tmpDir, queryPath);
    expect(fs.existsSync(fullPath)).toBe(true);

    const content = fs.readFileSync(fullPath, "utf-8");
    expect(content).toContain("category: query");
    expect(content).toContain("last_updated: \"2024-10-01\"");
    expect(content).toContain("$42M");
  });

  it("sanitizes special chars in the slug", async () => {
    const { writeQueryPage } = await importWriter();
    const message = {
      content: "What's the budget? (FY2024/25) — $42M!",
    };
    const { path: queryPath } = writeQueryPage(message, "2024-10-01");
    // Slug should not contain special chars
    expect(queryPath).toMatch(/^queries\/2024-10-01-[a-z0-9-]+\.md$/);
  });

  it("handles empty content gracefully", async () => {
    const { writeQueryPage } = await importWriter();
    const { path: queryPath } = writeQueryPage({ content: "" }, "2024-10-01");
    expect(queryPath).toMatch(/^queries\//);
  });
});
