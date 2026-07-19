import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let tmpDir: string;

// Re-import after resetting modules so WIKI_PATH picks up the new env var
async function importReader() {
  vi.resetModules();
  return import("../lib/wiki/reader");
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-reader-test-"));
  process.env.WIKI_PATH = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.WIKI_PATH;
});

function writeFixture(relPath: string, content: string) {
  const full = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf-8");
}

const SAMPLE_PAGE = `---
title: Budget Overview
type: wiki
category: topic
sources:
  - budget-fy2024.pdf
last_updated: "2024-10-01"
---

The city adopted a $42M general fund budget for FY2024 [SOURCE: budget-fy2024.pdf, p.3].
`;

describe("readWikiPage", () => {
  it("parses frontmatter and content correctly", async () => {
    writeFixture("topics/budget.md", SAMPLE_PAGE);
    const { readWikiPage } = await importReader();
    const page = readWikiPage("topics/budget.md");

    expect(page).not.toBeNull();
    expect(page!.title).toBe("Budget Overview");
    expect(page!.category).toBe("topic");
    expect(page!.sources).toEqual(["budget-fy2024.pdf"]);
    expect(page!.lastUpdated).toBe("2024-10-01");
    expect(page!.content).toContain("$42M general fund");
    expect(page!.path).toBe("topics/budget.md");
  });

  it("returns null for a missing file", async () => {
    const { readWikiPage } = await importReader();
    expect(readWikiPage("does-not-exist.md")).toBeNull();
  });

  it("falls back to filename when title is missing from frontmatter", async () => {
    writeFixture("topics/fallback.md", `---\ncategory: topic\n---\n\nContent here.`);
    const { readWikiPage } = await importReader();
    const page = readWikiPage("topics/fallback.md");
    expect(page!.title).toBe("fallback");
  });

  it("defaults category to topic when missing", async () => {
    writeFixture("topics/no-cat.md", `---\ntitle: No Cat\n---\n\nContent.`);
    const { readWikiPage } = await importReader();
    const page = readWikiPage("topics/no-cat.md");
    expect(page!.category).toBe("topic");
  });
});

describe("readWikiIndex", () => {
  it("returns empty array when index.md is absent", async () => {
    const { readWikiIndex } = await importReader();
    expect(readWikiIndex()).toEqual([]);
  });

  it("parses table rows from index.md", async () => {
    const index = `# Wiki Index\n\n## Topics\n| [[topics/budget.md]] | City budget summary | 2024-10-01 | 3 |\n`;
    writeFixture("index.md", index);
    const { readWikiIndex } = await importReader();

    const entries = readWikiIndex();
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe("topics/budget.md");
    expect(entries[0].summary).toBe("City budget summary");
    expect(entries[0].lastUpdated).toBe("2024-10-01");
    expect(entries[0].sourceCount).toBe(3);
    expect(entries[0].category).toBe("topic");
  });

  it("infers category from path prefix", async () => {
    const index = `# Wiki Index\n\n## Decisions\n| [[decisions/2024-01-10-council.md]] | Council vote | 2024-01-10 | 1 |\n`;
    writeFixture("index.md", index);
    const { readWikiIndex } = await importReader();

    const entries = readWikiIndex();
    expect(entries[0].category).toBe("decision");
  });

  it("handles multiple rows across sections", async () => {
    const index = [
      "# Wiki Index",
      "## Topics",
      "| [[topics/parks.md]] | Parks info | 2024-05-01 | 2 |",
      "## Decisions",
      "| [[decisions/2024-02-01-council.md]] | Zoning vote | 2024-02-01 | 1 |",
    ].join("\n");
    writeFixture("index.md", index);
    const { readWikiIndex } = await importReader();

    expect(readWikiIndex()).toHaveLength(2);
  });

  it("decodes &#124; escape in path and summary containing pipe characters", async () => {
    writeFixture(
      "index.md",
      "## Topics\n| [[topics/budget&#124;overview.md]] | Revenue&#124;Expenditure summary | 2024-01-01 | 3 |\n"
    );
    const { readWikiIndex } = await importReader();

    const entries = readWikiIndex();
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe("topics/budget|overview.md");
    expect(entries[0].summary).toBe("Revenue|Expenditure summary");
  });
});

describe("readFullWiki", () => {
  it("excludes index.md — it is navigation metadata, not analyzable content (#227)", async () => {
    writeFixture("index.md", "# Wiki Index\n> City: Schertz, TX\n");
    writeFixture("topics/budget.md", SAMPLE_PAGE);
    const { readFullWiki } = await importReader();

    const pages = readFullWiki();
    expect(pages).toHaveLength(1);
    expect(pages[0].path).toBe("topics/budget.md");
  });

  it("returns an empty array when only index.md exists (no real content yet)", async () => {
    writeFixture("index.md", "# Wiki Index\n> City: Schertz, TX\n");
    const { readFullWiki } = await importReader();
    expect(readFullWiki()).toEqual([]);
  });

  it("still excludes SCHEMA.md alongside real content", async () => {
    writeFixture("SCHEMA.md", "# Schema doc");
    writeFixture("topics/budget.md", SAMPLE_PAGE);
    const { readFullWiki } = await importReader();

    const pages = readFullWiki();
    expect(pages).toHaveLength(1);
    expect(pages[0].path).toBe("topics/budget.md");
  });
});

describe("readRelevantPages", () => {
  it("returns pages that exist, skips those that don't", async () => {
    writeFixture("topics/budget.md", SAMPLE_PAGE);
    const { readRelevantPages } = await importReader();

    const pages = readRelevantPages(["topics/budget.md", "topics/missing.md"]);
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe("Budget Overview");
  });

  it("appends .md extension when not provided", async () => {
    writeFixture("topics/budget.md", SAMPLE_PAGE);
    const { readRelevantPages } = await importReader();
    const pages = readRelevantPages(["topics/budget"]);
    expect(pages).toHaveLength(1);
  });
});

describe("buildWikiContext", () => {
  it("formats pages into a context string with path headers", async () => {
    writeFixture("topics/budget.md", SAMPLE_PAGE);
    const { readWikiPage, buildWikiContext } = await importReader();
    const page = readWikiPage("topics/budget.md")!;
    const ctx = buildWikiContext([page]);

    expect(ctx).toContain("WIKI PAGE: topics/budget.md");
    expect(ctx).toContain("$42M general fund");
  });

  it("separates multiple pages with double newlines", async () => {
    writeFixture("topics/budget.md", SAMPLE_PAGE);
    const { readWikiPage, buildWikiContext } = await importReader();
    const page = readWikiPage("topics/budget.md")!;
    const ctx = buildWikiContext([page, page]);

    expect(ctx.split("WIKI PAGE:")).toHaveLength(3);
  });
});
