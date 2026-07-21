import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { WikiPage, WikiIndexEntry } from "@/types";

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
      path: match[1].trim().replace(/&#124;/g, "|"),
      summary: match[2].trim().replace(/&#124;/g, "|"),
      lastUpdated: match[3].trim(),
      sourceCount: parseInt(match[4].trim(), 10),
      category: inferCategory(match[1].trim().replace(/&#124;/g, "|")),
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
      entry.name !== "SCHEMA.md" &&
      entry.name !== "index.md"
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
  if (pagePath.startsWith("briefings/")) return "briefing";
  return "topic";
}

// ─── Build context string for Claude ──────────────────────────────────────
//
// Adds pages one-by-one, stopping before the cumulative token estimate
// (text.length / 4) would exceed maxTokens.  A truncation notice is
// appended whenever pages are omitted so Claude knows the context is partial.

export function buildWikiContext(pages: WikiPage[], maxTokens = 80_000): string {
  const maxChars = maxTokens * 4;
  // No single page may consume more than 1/8 of the budget: production topic
  // pages grow by append on every ingest and reached >500k chars — larger
  // than entire budgets. The old code `break`ed at the first page that
  // didn't fit, so one oversized page starved the whole context ("0 of 82
  // pages included") and the LINT AI analyzed nothing (#257). Oversized
  // pages are sliced to the cap; pages that don't fit the remaining budget
  // are skipped, never fatal.
  const perPageCap = Math.max(2_000, Math.floor(maxChars / 8));

  const sections: string[] = [];
  let cumulativeChars = 0;
  let omitted = 0;
  let sliced = 0;

  for (const p of pages) {
    const header = `=== WIKI PAGE: ${p.path} (updated ${p.lastUpdated}) ===\n`;
    let body = p.content;
    if (header.length + body.length > perPageCap) {
      body =
        body.slice(0, Math.max(0, perPageCap - header.length)) +
        "\n<!-- page truncated to fit context budget -->";
      sliced++;
    }
    const section = header + body;
    if (cumulativeChars + section.length > maxChars) {
      omitted++;
      continue; // skip this page but keep trying smaller ones
    }
    sections.push(section);
    cumulativeChars += section.length + 2; // +2 for the "\n\n" separator
  }

  const context = sections.join("\n\n");
  if (omitted === 0 && sliced === 0) return context;

  const notice =
    `\n\n<!-- TRUNCATION NOTICE: Context limited to ~${maxTokens} tokens. ` +
    `${sections.length} of ${pages.length} pages included` +
    `${sliced > 0 ? ` (${sliced} truncated to fit)` : ""}; ` +
    `${omitted} page(s) omitted. -->`;

  return context + notice;
}
