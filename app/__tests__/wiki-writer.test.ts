import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import matter from "gray-matter";
import type { WikiPage, Recommendation } from "../types";

let tmpDir: string;

async function importWriter() {
  vi.resetModules();
  return import("../lib/wiki/writer");
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-writer-test-"));
  process.env.WIKI_PATH = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.WIKI_PATH;
});

const samplePage = (): WikiPage => ({
  title: "Budget Overview",
  type: "wiki",
  category: "topic",
  sources: ["budget-fy2024.pdf"],
  lastUpdated: "2024-10-01",
  content: "The city adopted a $42M general fund budget.",
  path: "topics/budget.md",
});

describe("writeWikiPage", () => {
  it("creates the file with correct frontmatter and content", async () => {
    const { writeWikiPage } = await importWriter();
    writeWikiPage(samplePage());

    const filePath = path.join(tmpDir, "topics/budget.md");
    expect(fs.existsSync(filePath)).toBe(true);

    const { data, content } = matter(fs.readFileSync(filePath, "utf-8"));
    expect(data.title).toBe("Budget Overview");
    expect(data.category).toBe("topic");
    expect(data.sources).toEqual(["budget-fy2024.pdf"]);
    expect(data.last_updated).toBe("2024-10-01");
    expect(content).toContain("$42M general fund");
  });

  it("creates nested directories as needed", async () => {
    const { writeWikiPage } = await importWriter();
    writeWikiPage({ ...samplePage(), path: "decisions/2024/council.md" });
    expect(fs.existsSync(path.join(tmpDir, "decisions/2024/council.md"))).toBe(true);
  });

  it("overwrites an existing page", async () => {
    const { writeWikiPage } = await importWriter();
    writeWikiPage(samplePage());
    writeWikiPage({ ...samplePage(), content: "Updated content." });

    const raw = fs.readFileSync(path.join(tmpDir, "topics/budget.md"), "utf-8");
    expect(raw).toContain("Updated content.");
    expect(raw).not.toContain("$42M");
  });
});

describe("appendToWikiPage", () => {
  it("appends a new section to an existing page", async () => {
    const { writeWikiPage, appendToWikiPage } = await importWriter();
    writeWikiPage(samplePage());

    const result = appendToWikiPage(
      "topics/budget.md",
      "FY2025 Amendment",
      "Council approved $1M increase.",
      "2025-01-15"
    );

    expect(result).toBe(true);
    const raw = fs.readFileSync(path.join(tmpDir, "topics/budget.md"), "utf-8");
    expect(raw).toContain("### FY2025 Amendment");
    expect(raw).toContain("Council approved $1M increase.");
  });

  it("updates last_updated in frontmatter", async () => {
    const { writeWikiPage, appendToWikiPage } = await importWriter();
    writeWikiPage(samplePage());
    appendToWikiPage("topics/budget.md", "Section", "Content.", "2025-03-01");

    const { data } = matter(fs.readFileSync(path.join(tmpDir, "topics/budget.md"), "utf-8"));
    expect(data.last_updated).toBe("2025-03-01");
  });

  it("returns false when the file does not exist", async () => {
    const { appendToWikiPage } = await importWriter();
    const result = appendToWikiPage("topics/missing.md", "Sec", "Body.", "2025-01-01");
    expect(result).toBe(false);
  });
});

describe("writeDecisionsPage", () => {
  it("creates a decisions page at the expected path", async () => {
    const { writeDecisionsPage } = await importWriter();
    const pagePath = writeDecisionsPage(
      "2024-01-10",
      "City Council",
      "Voted 5-0 to approve ordinance.",
      ["agenda-2024-01-10.pdf"]
    );

    expect(pagePath).toBe("decisions/2024-01-10-city-council.md");
    expect(fs.existsSync(path.join(tmpDir, pagePath))).toBe(true);
  });

  it("writes correct title and category in frontmatter", async () => {
    const { writeDecisionsPage } = await importWriter();
    const pagePath = writeDecisionsPage("2024-01-10", "City Council", "Content.", []);

    const { data } = matter(fs.readFileSync(path.join(tmpDir, pagePath), "utf-8"));
    expect(data.title).toBe("City Council Meeting — 2024-01-10");
    expect(data.category).toBe("decision");
  });
});

const sampleRecommendation = (): Recommendation => ({
  id: "rec-001",
  title: "Improve Road Maintenance",
  severity: "high",
  finding: "Roads in district 3 are deteriorating.",
  evidence: ["Inspection report Q1 2024"],
  comparableCities: ["Austin, TX"],
  suggestedAction: "Allocate $2M for resurfacing.",
  discussionQuestions: ["What is the timeline?"],
  sourcesAnalyzed: ["roads-report-2024.pdf"],
  generatedAt: "2026-06-03",
  path: "",
});

describe("writeRecommendationPage", () => {
  it("creates a new dated file when no existing slug match", async () => {
    const { writeRecommendationPage } = await importWriter();
    fs.mkdirSync(path.join(tmpDir, "recommendations"), { recursive: true });

    const rec = sampleRecommendation();
    const pagePath = writeRecommendationPage(rec);

    expect(pagePath).toBe("recommendations/2026-06-03-improve-road-maintenance.md");
    expect(fs.existsSync(path.join(tmpDir, pagePath))).toBe(true);
  });

  it("updates the existing file in place when slug already exists", async () => {
    const { writeRecommendationPage } = await importWriter();
    fs.mkdirSync(path.join(tmpDir, "recommendations"), { recursive: true });

    // First write — creates 2026-06-03-improve-road-maintenance.md
    const rec1 = sampleRecommendation();
    const firstPath = writeRecommendationPage(rec1);
    expect(firstPath).toBe("recommendations/2026-06-03-improve-road-maintenance.md");

    // Second write with a different date — should reuse the existing file, not create a new one
    const rec2 = { ...sampleRecommendation(), generatedAt: "2026-06-04" };
    const secondPath = writeRecommendationPage(rec2);

    expect(secondPath).toBe(firstPath); // same file, not a new dated file
    const files = fs.readdirSync(path.join(tmpDir, "recommendations"));
    expect(files).toHaveLength(1); // only one file in the directory
  });

  it("updates last_updated frontmatter when reusing existing file", async () => {
    const { writeRecommendationPage } = await importWriter();
    fs.mkdirSync(path.join(tmpDir, "recommendations"), { recursive: true });

    writeRecommendationPage(sampleRecommendation());
    const updatedRec = { ...sampleRecommendation(), generatedAt: "2026-06-05" };
    const pagePath = writeRecommendationPage(updatedRec);

    const { data } = matter(fs.readFileSync(path.join(tmpDir, pagePath), "utf-8"));
    expect(data.last_updated).toBe("2026-06-05");
  });

  it("creates separate files for recommendations with different titles", async () => {
    const { writeRecommendationPage } = await importWriter();
    fs.mkdirSync(path.join(tmpDir, "recommendations"), { recursive: true });

    writeRecommendationPage(sampleRecommendation());
    writeRecommendationPage({ ...sampleRecommendation(), title: "Fix Water Pipes", id: "rec-002" });

    const files = fs.readdirSync(path.join(tmpDir, "recommendations"));
    expect(files).toHaveLength(2);
  });

  it("writes category: recommendation in frontmatter", async () => {
    const { writeRecommendationPage } = await importWriter();
    fs.mkdirSync(path.join(tmpDir, "recommendations"), { recursive: true });

    const pagePath = writeRecommendationPage(sampleRecommendation());
    const { data } = matter(fs.readFileSync(path.join(tmpDir, pagePath), "utf-8"));
    expect(data.category).toBe("recommendation");
  });
});

describe("appendToLog", () => {
  it("creates log.md if it does not exist", async () => {
    const { appendToLog } = await importWriter();
    appendToLog("## [2024-10-01] Ingested budget.pdf");
    expect(fs.existsSync(path.join(tmpDir, "log.md"))).toBe(true);
  });

  it("appends multiple entries in order", async () => {
    const { appendToLog } = await importWriter();
    appendToLog("## [2024-10-01] First entry");
    appendToLog("## [2024-10-02] Second entry");

    const raw = fs.readFileSync(path.join(tmpDir, "log.md"), "utf-8");
    expect(raw).toContain("First entry");
    expect(raw).toContain("Second entry");
    expect(raw.indexOf("First entry")).toBeLessThan(raw.indexOf("Second entry"));
  });
});

describe("updateWikiIndex", () => {
  it("does nothing when index.md is absent", async () => {
    const { updateWikiIndex } = await importWriter();
    expect(() =>
      updateWikiIndex([{ path: "topics/x.md", summary: "X", date: "2024-01-01", sourceCount: 1, category: "topic" }])
    ).not.toThrow();
  });

  it("appends a new row under the correct section", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "index.md"),
      `# Wiki Index\n> Last updated: 2024-01-01 | Pages: 0\n\n## Topics\n`,
      "utf-8"
    );
    const { updateWikiIndex } = await importWriter();

    updateWikiIndex([
      { path: "topics/budget.md", summary: "Budget summary", date: "2024-10-01", sourceCount: 2, category: "topic" },
    ]);

    const raw = fs.readFileSync(path.join(tmpDir, "index.md"), "utf-8");
    expect(raw).toContain("[[topics/budget.md]]");
    expect(raw).toContain("Budget summary");
  });

  it("reflects actual row count in the Pages header", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "index.md"),
      `# Wiki Index\n> Last updated: 2024-01-01 | Pages: 0\n\n## Topics\n`,
      "utf-8"
    );
    const { updateWikiIndex } = await importWriter();

    updateWikiIndex([
      { path: "topics/a.md", summary: "A", date: "2024-01-01", sourceCount: 1, category: "topic" },
      { path: "topics/b.md", summary: "B", date: "2024-01-01", sourceCount: 1, category: "topic" },
    ]);

    const raw = fs.readFileSync(path.join(tmpDir, "index.md"), "utf-8");
    expect(raw).toContain("Pages: 2");
  });

  it("skips duplicate paths on re-ingest", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "index.md"),
      `# Wiki Index\n> Last updated: 2024-01-01 | Pages: 0\n\n## Topics\n`,
      "utf-8"
    );
    const { updateWikiIndex } = await importWriter();

    updateWikiIndex([{ path: "topics/x.md", summary: "X", date: "2024-01-01", sourceCount: 1, category: "topic" }]);
    updateWikiIndex([{ path: "topics/x.md", summary: "X", date: "2024-01-01", sourceCount: 1, category: "topic" }]);

    const raw = fs.readFileSync(path.join(tmpDir, "index.md"), "utf-8");
    const occurrences = (raw.match(/\[\[topics\/x\.md\]\]/g) ?? []).length;
    expect(occurrences).toBe(1);
    expect(raw).toContain("Pages: 1");
  });

  it("escapes pipe characters in path and summary with &#124;", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "index.md"),
      `# Wiki Index\n> Last updated: 2024-01-01 | Pages: 0\n\n## Topics\n`,
      "utf-8"
    );
    const { updateWikiIndex } = await importWriter();

    updateWikiIndex([{
      path: "topics/budget|overview.md",
      summary: "Revenue|Expenditure breakdown",
      date: "2024-01-01",
      sourceCount: 2,
      category: "topic",
    }]);

    const raw = fs.readFileSync(path.join(tmpDir, "index.md"), "utf-8");
    // Raw table must not have unescaped pipes inside the cell values
    expect(raw).toContain("[[topics/budget&#124;overview.md]]");
    expect(raw).toContain("Revenue&#124;Expenditure breakdown");
    // Must NOT contain a raw pipe within the wikilink path
    expect(raw).not.toMatch(/\[\[topics\/budget\|/);
  });
});
