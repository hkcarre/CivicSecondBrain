import fs from "fs";
import path from "path";
import type { WikiPage, IngestResult, Recommendation } from "@/types";

const WIKI_PATH = process.env.WIKI_PATH ?? "./wiki";

// ─── Write or update a wiki page ──────────────────────────────────────────

export function writeWikiPage(page: WikiPage): void {
  const fullPath = path.join(WIKI_PATH, page.path);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const frontmatter = [
    "---",
    `title: "${page.title.replace(/"/g, '\\"')}"`,
    `type: wiki`,
    `category: ${page.category}`,
    `sources:`,
    ...(page.sources ?? []).map((s) => `  - ${s}`),
    `last_updated: "${page.lastUpdated}"`,
    "---",
    "",
  ].join("\n");

  fs.writeFileSync(fullPath, frontmatter + page.content, "utf-8");
}

// ─── Append content to an existing wiki page ──────────────────────────────

export function appendToWikiPage(
  pagePath: string,
  sectionHeading: string,
  content: string,
  updatedDate: string
): boolean {
  const fullPath = path.join(WIKI_PATH, pagePath);
  if (!fs.existsSync(fullPath)) return false;

  const raw = fs.readFileSync(fullPath, "utf-8");

  // Update last_updated in frontmatter
  const updated = raw
    .replace(/^last_updated: .+$/m, `last_updated: "${updatedDate}"`)
    .trimEnd();

  const appendBlock = `\n\n### ${sectionHeading}\n\n${content}`;
  fs.writeFileSync(fullPath, updated + appendBlock, "utf-8");
  return true;
}

// ─── Write a decisions page for a specific meeting ────────────────────────

export function writeDecisionsPage(
  meetingDate: string,
  board: string,
  content: string,
  sources: string[]
): string {
  const slug = board.replace(/\s+/g, "-").toLowerCase();
  const pagePath = `decisions/${meetingDate}-${slug}.md`;

  const page: WikiPage = {
    title: `${board} Meeting — ${meetingDate}`,
    type: "wiki",
    category: "decision",
    sources,
    lastUpdated: meetingDate,
    content,
    path: pagePath,
  };

  writeWikiPage(page);
  return pagePath;
}

// ─── Write a recommendation page ──────────────────────────────────────────

export function writeRecommendationPage(rec: Recommendation): string {
  const slug = rec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Check if an existing recommendation file already contains this slug
  const recsDir = path.join(WIKI_PATH, "recommendations");
  let pagePath: string | null = null;

  if (fs.existsSync(recsDir)) {
    const existing = fs.readdirSync(recsDir).find((f) => f.includes(slug));
    if (existing) {
      pagePath = `recommendations/${existing}`;
    }
  }

  // No existing file found — create a new dated file
  if (!pagePath) {
    pagePath = `recommendations/${rec.generatedAt}-${slug}.md`;
  }

  const content = `
## AI ANALYSIS — Requires Council Review

**Finding:** ${rec.finding}

**Evidence:**
${rec.evidence.map((e) => `- ${e}`).join("\n")}

${
  rec.comparableCities?.length
    ? `**Comparable Cities:**\n${rec.comparableCities.map((c) => `- ${c}`).join("\n")}\n`
    : ""
}
**Suggested Action:** ${rec.suggestedAction}

**Council Discussion Questions:**
${rec.discussionQuestions.map((q) => `- ${q}`).join("\n")}

**Sources Analyzed:**
${rec.sourcesAnalyzed.map((s) => `- [[${s}]]`).join("\n")}
`;

  const page: WikiPage = {
    title: `${rec.title} — ${rec.generatedAt}`,
    type: "wiki",
    category: "recommendation",
    sources: rec.sourcesAnalyzed,
    lastUpdated: rec.generatedAt,
    content: content.trim(),
    path: pagePath,
  };

  writeWikiPage(page);
  return pagePath;
}

// ─── Update wiki/index.md ──────────────────────────────────────────────────

export function updateWikiIndex(
  newEntries: Array<{
    path: string;
    summary: string;
    date: string;
    sourceCount: number;
    category: string;
  }>
): void {
  const indexPath = path.join(WIKI_PATH, "index.md");
  if (!fs.existsSync(indexPath)) return;

  let content = fs.readFileSync(indexPath, "utf-8");

  const today = new Date().toISOString().split("T")[0];
  content = content.replace(/Last updated: [\d-]+/, `Last updated: ${today}`);

  // Remove the "empty" placeholder lines
  content = content.replace(/\| \*\(empty[^)]+\)\* \| \| \| \|\n/g, "");

  // Build set of paths already in the index to avoid duplicates
  const existingPaths = new Set<string>();
  const existingRowRegex = /\[\[([^\]]+)\]\]/g;
  let m;
  while ((m = existingRowRegex.exec(content)) !== null) {
    existingPaths.add(m[1].trim());
  }

  // Append only new rows under the appropriate section
  let addedCount = 0;
  for (const entry of newEntries) {
    if (existingPaths.has(entry.path)) continue;
    existingPaths.add(entry.path);
    addedCount++;

    const sectionMap: Record<string, string> = {
      topic: "## Topics",
      decision: "## Decisions",
      person: "## People & Boards",
      recommendation: "## Recommendations",
      query: "## Queries Filed",
    };
    const section = sectionMap[entry.category] ?? "## Topics";
    const row = `| [[${entry.path}]] | ${entry.summary.slice(0, 80)} | ${entry.date} | ${entry.sourceCount} |\n`;
    content = content.replace(section, `${section}\n${row}`);
  }

  // Recalculate count from actual rows rather than incrementing
  const rowCount = (content.match(/^\| \[\[/gm) ?? []).length;
  content = content.replace(/Pages: \d+/, `Pages: ${rowCount}`);

  fs.writeFileSync(indexPath, content, "utf-8");
}

// ─── Write a saved query page ─────────────────────────────────────────────

export function writeQueryPage(
  message: { content: string; timestamp?: string },
  date: string
): { path: string; title: string } {
  // Derive a slug from the first sentence or first 60 chars
  const firstLine = message.content.split("\n")[0].slice(0, 60).trim();
  const slug = firstLine
    .replace(/[^a-z0-9\s-]/gi, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);

  const pagePath = `queries/${date}-${slug}.md`;
  const title = `Q&A — ${firstLine}`;

  const page: WikiPage = {
    title,
    type: "wiki",
    category: "query",
    sources: [],
    lastUpdated: date,
    content: message.content,
    path: pagePath,
  };

  writeWikiPage(page);
  return { path: pagePath, title };
}

// ─── Append to wiki/log.md ─────────────────────────────────────────────────

export function appendToLog(entry: string): void {
  const logPath = path.join(WIKI_PATH, "log.md");
  const existing = fs.existsSync(logPath)
    ? fs.readFileSync(logPath, "utf-8")
    : "";
  fs.writeFileSync(logPath, existing.trimEnd() + "\n\n" + entry + "\n", "utf-8");
}
