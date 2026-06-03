/**
 * Reads wiki state to hydrate the dashboard.
 * Called server-side from the dashboard page.
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { readWikiIndex, readRecentLog } from "./reader";
import type { Recommendation, WikiHealthReport } from "@/types";

const WIKI_PATH = process.env.WIKI_PATH ?? "./wiki";

export interface DashboardData {
  recommendations: Recommendation[];
  healthReport: WikiHealthReport | null;
  recentLog: Array<{ date: string; operation: string; label: string }>;
  stats: {
    sourcesIngested: number;
    wikiPages: number;
    decisionsLogged: number;
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const recommendations = readRecommendations();
  const healthReport = buildHealthReport(recommendations);
  const recentLog = parseRecentLog();
  const stats = computeStats();

  return { recommendations, healthReport, recentLog, stats };
}

// ─── Read recommendation pages ─────────────────────────────────────────────

function readRecommendations(): Recommendation[] {
  const recDir = path.join(WIKI_PATH, "recommendations");
  if (!fs.existsSync(recDir)) return [];

  const files = fs
    .readdirSync(recDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse() // newest first
    .slice(0, 20); // last 20

  return files
    .map((file) => {
      try {
        const raw = fs.readFileSync(path.join(recDir, file), "utf-8");
        const { data, content } = matter(raw);

        // Extract fields from content
        const finding = extractField(content, "Finding");
        const suggestedAction = extractField(content, "Suggested Action");
        const evidenceLines = extractList(content, "Evidence");
        const discussionLines = extractList(content, "Council Discussion Questions");
        const comparableLines = extractList(content, "Comparable Cities");

        return {
          id: file.replace(".md", ""),
          title: data.title ?? file.replace(".md", ""),
          severity: data.severity ?? "medium",
          finding: finding ?? "See full analysis",
          evidence: evidenceLines,
          comparableCities: comparableLines.length ? comparableLines : undefined,
          suggestedAction: suggestedAction ?? "Review with council",
          discussionQuestions: discussionLines,
          sourcesAnalyzed: data.sources ?? [],
          generatedAt: data.last_updated ?? new Date().toISOString().split("T")[0],
          path: `recommendations/${file}`,
        } as Recommendation;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Recommendation[];
}

// ─── Build health report from wiki state ──────────────────────────────────

function buildHealthReport(recommendations: Recommendation[]): WikiHealthReport | null {
  const index = readWikiIndex();
  if (index.length === 0) return null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const stalePages = index
    .filter((e) => {
      if (!e.lastUpdated) return false;
      return new Date(e.lastUpdated) < thirtyDaysAgo;
    })
    .map((e) => e.path);

  const topActions = recommendations
    .filter((r) => r.severity === "high")
    .slice(0, 3)
    .map((r) => r.suggestedAction);

  return {
    runAt: new Date().toISOString(),
    pagesAnalyzed: index.length,
    stalePages,
    contradictions: [],
    missingDecisions: [],
    boardGaps: [],
    recommendations,
    topActions,
  };
}

// ─── Parse log entries for activity feed ─────────────────────────────────

function parseRecentLog(): Array<{
  date: string;
  operation: string;
  label: string;
}> {
  const logPath = path.join(WIKI_PATH, "log.md");
  if (!fs.existsSync(logPath)) return [];

  const raw = fs.readFileSync(logPath, "utf-8");
  const entries: Array<{ date: string; operation: string; label: string }> = [];

  const regex = /^## \[(\d{4}-\d{2}-\d{2})\] ([A-Z-]+) \| (.+)$/gm;
  let match;

  while ((match = regex.exec(raw)) !== null) {
    entries.push({
      date: match[1],
      operation: match[2],
      label: match[3],
    });
  }

  return entries.reverse().slice(0, 15);
}

// ─── Compute wiki stats ────────────────────────────────────────────────────

function computeStats() {
  const index = readWikiIndex();

  // Count ingests from log
  const logPath = path.join(WIKI_PATH, "log.md");
  let sourcesIngested = 0;
  if (fs.existsSync(logPath)) {
    const log = fs.readFileSync(logPath, "utf-8");
    const ingestMatches = log.match(/^## \[.+\] INGEST/gm) ?? [];
    sourcesIngested = ingestMatches.length;
  }

  const decisionsLogged = index.filter((e) =>
    e.path.startsWith("decisions/")
  ).length;

  return {
    sourcesIngested,
    wikiPages: index.length,
    decisionsLogged,
  };
}

// ─── Content parsers ───────────────────────────────────────────────────────

function extractField(content: string, fieldName: string): string | null {
  const regex = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*([^\\n]+)`, "i");
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function extractList(content: string, sectionName: string): string[] {
  const regex = new RegExp(
    `\\*\\*${sectionName}:\\*\\*\\n((?:- [^\\n]+\\n?)+)`,
    "i"
  );
  const match = content.match(regex);
  if (!match) return [];
  return match[1]
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
}
