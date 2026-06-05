import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { WikiPage, WikiIndex, WikiIndexEntry } from "@/types";

const WIKI_PATH = process.env.WIKI_PATH ?? "./wiki";

// ─── Read a single wiki page ───────────────────────────────────────────────

export function readWikiPage(pagePath: string): WikiPage | null {
  const fullPath = path.join(WIKI_PATH, pagePath);
  if (!fs.existsSync(fullPath)) return null;

  const raw = fs.readFileSync(fullPath, "utf-8");

  let data: Record<string, unknown> = {};
  let content = raw;

  try {
    const parsed = matter(raw);
    data = parsed.data;
    content = parsed.content;
  } catch {
    // YAML parse error (e.g. unquoted colon in title).
    // Auto-repair: re-quote the title line and retry once.
    const repaired = raw.replace(
      /^(title:\s*)(.+)$/m,
      (_match, prefix, value) => {
        const trimmed = value.trim();
        if (!trimmed.startsWith('"')) {
          return `${prefix}"${trimmed.replace(/"/g, '\\"')}"`;
        }
        return _match;
      }
    );
    try {
      const parsed = matter(repaired);
      data = parsed.data;
      content = parsed.content;
      // Persist the repair so future reads don't need it
      fs.writeFileSync(fullPath, repaired, "utf-8");
    } catch {
      // Still broken — return null and skip this page
      console.warn(`  ⚠ Skipping unparseable wiki page: ${pagePath}`);
      return null;
    }
  }

  return {
    title: data.title as string ?? path.basename(pagePath, ".md"),
    type: "wiki",
    category: data.category as WikiPage["category"] ?? "topic",
    sources: data.sources as string[] ?? [],
    lastUpdated: data.last_updated as string ?? "",
    content,
    path: pagePath,
  };
}

// ─── Read wiki/index.md ────────────────────────────────────────────────────

export function readWikiIndex(): WikiIndexEntry[] {
  const indexPath = path.join(WIKI_PATH, "index.md");
  if (!fs.existsSync(indexPath)) return [];

  const raw = fs.readFileSync(indexPath, "utf-8");
  const entries: WikiIndexEntry[] = [];

  // Parse markdown table rows: | path | summary | date | count |
  const tableRowRegex = /^\|\s*\[\[([^\]]+)\]\]\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*(\d+)/gm;
  let match;
  while ((match = tableRowRegex.exec(raw)) !== null) {
    entries.push({
      path: match[1].trim(),
      summary: match[2].trim(),
      lastUpdated: match[3].trim(),
      sourceCount: parseInt(match[4].trim(), 10),
      category: inferCategory(match[1].trim()),
    });
  }

  return entries;
}

// ─── Read all pages relevant to a query ───────────────────────────────────

export function readRelevantPages(topics: string[]): WikiPage[] {
  const pages: WikiPage[] = [];
  for (const topic of topics) {
    const page = readWikiPage(topic.endsWith(".md") ? topic : `${topic}.md`);
    if (page) pages.push(page);
  }
  return pages;
}

// ─── Read full wiki for LINT ───────────────────────────────────────────────

export function readFullWiki(): WikiPage[] {
  const pages: WikiPage[] = [];
  readDirRecursive(WIKI_PATH, pages);
  return pages;
}

function readDirRecursive(dir: string, pages: WikiPage[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip raw-sources
      if (entry.name === "raw-sources") continue;
      readDirRecursive(fullPath, pages);
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".md") &&
      entry.name !== "SCHEMA.md"
    ) {
      const relativePath = path.relative(WIKI_PATH, fullPath);
      const page = readWikiPage(relativePath);
      if (page) pages.push(page);
    }
  }
}

// ─── Read wiki/log.md (last N entries) ────────────────────────────────────

export function readRecentLog(n = 10): string {
  const logPath = path.join(WIKI_PATH, "log.md");
  if (!fs.existsSync(logPath)) return "";

  const raw = fs.readFileSync(logPath, "utf-8");
  const entries = raw.split(/(?=^## \[)/m).filter((e) => e.startsWith("## ["));
  return entries.slice(-n).join("\n\n");
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function inferCategory(pagePath: string): WikiIndexEntry["category"] {
  if (pagePath.startsWith("topics/")) return "topic";
  if (pagePath.startsWith("decisions/")) return "decision";
  if (pagePath.startsWith("people/")) return "person";
  if (pagePath.startsWith("recommendations/")) return "recommendation";
  if (pagePath.startsWith("queries/")) return "query";
  return "topic";
}

// ─── Build context string for Claude ──────────────────────────────────────
//
// Adds pages one-by-one, stopping before the cumulative token estimate
// (text.length / 4) would exceed maxTokens.  A truncation notice is
// appended whenever pages are omitted so Claude knows the context is partial.

export function buildWikiContext(pages: WikiPage[], maxTokens = 80_000): string {
  const sections: string[] = [];
  let cumulativeChars = 0;
  let truncated = false;

  for (const p of pages) {
    const section = `=== WIKI PAGE: ${p.path} (updated ${p.lastUpdated}) ===\n${p.content}`;
    const estimatedTokens = (cumulativeChars + section.length) / 4;
    if (estimatedTokens > maxTokens) {
      truncated = true;
      break;
    }
    sections.push(section);
    cumulativeChars += section.length + 2; // +2 for the "\n\n" separator
  }

  const context = sections.join("\n\n");
  if (!truncated) return context;

  const included = sections.length;
  const omitted = pages.length - included;
  const notice =
    `\n\n<!-- TRUNCATION NOTICE: Context limited to ~${maxTokens} tokens. ` +
    `${included} of ${pages.length} pages included; ${omitted} page(s) omitted. -->`;

  return context + notice;
}
