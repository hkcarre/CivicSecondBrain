/**
 * GET /api/export/recommendations
 *
 * Returns all current recommendations as a Markdown (.md) file suitable
 * for inclusion in council packets.
 *
 * Query params:
 *   format=md   (default) — returns Markdown
 *   format=pdf  — returns a simple HTML-to-PDF via built-in browser print
 *                 (falls back to md if @react-pdf/renderer is not installed)
 *
 * Auth: intentionally public. Recommendations are shown on the public
 * dashboard and are meant for open council review — unlike /api/export/wiki
 * and /api/export/chat-log, which require verifyExportAccess().
 */

import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { Recommendation } from "@/types";

export const runtime = "nodejs";

const WIKI_PATH = process.env.WIKI_PATH ?? "./wiki";

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function readRecommendations(): Recommendation[] {
  const recDir = path.join(WIKI_PATH, "recommendations");
  if (!fs.existsSync(recDir)) return [];

  const files = fs
    .readdirSync(recDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse()
    .slice(0, 20);

  return files
    .map((file) => {
      try {
        const raw = fs.readFileSync(path.join(recDir, file), "utf-8");
        const { data, content } = matter(raw);

        return {
          id: file.replace(".md", ""),
          title: data.title ?? file.replace(".md", ""),
          severity: data.severity ?? "medium",
          finding: extractField(content, "Finding") ?? "See full analysis",
          evidence: extractList(content, "Evidence"),
          comparableCities: extractList(content, "Comparable Cities"),
          suggestedAction:
            extractField(content, "Suggested Action") ?? "Review with council",
          discussionQuestions: extractList(content, "Council Discussion Questions"),
          sourcesAnalyzed: data.sources ?? [],
          generatedAt:
            data.last_updated ?? new Date().toISOString().split("T")[0],
          path: `recommendations/${file}`,
        } as Recommendation;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Recommendation[];
}

// ─── Severity badge ──────────────────────────────────────────────────────────

function severityLabel(s: string): string {
  return s === "high" ? "🔴 High" : s === "low" ? "🟢 Low" : "🟡 Medium";
}

// ─── Markdown renderer ───────────────────────────────────────────────────────

function toMarkdown(recommendations: Recommendation[]): string {
  const now = new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "long",
    timeStyle: "short",
  });

  const lines: string[] = [
    "# Civic AI Recommendations",
    "",
    `> Generated: ${now} CT`,
    `> Total recommendations: ${recommendations.length}`,
    "> **All items require council review before any action is taken.**",
    "",
    "---",
    "",
  ];

  if (recommendations.length === 0) {
    lines.push("_No recommendations available. Run an analysis first._");
    return lines.join("\n");
  }

  for (const [i, rec] of recommendations.entries()) {
    lines.push(`## ${i + 1}. ${rec.title}`);
    lines.push("");
    lines.push(`**Severity:** ${severityLabel(rec.severity)}`);
    lines.push(`**Generated:** ${rec.generatedAt}`);
    lines.push("");
    lines.push("### Finding");
    lines.push(rec.finding);
    lines.push("");
    lines.push("### Suggested Action");
    lines.push(rec.suggestedAction);
    lines.push("");

    if (rec.evidence.length > 0) {
      lines.push("### Evidence");
      for (const e of rec.evidence) {
        lines.push(`- ${e}`);
      }
      lines.push("");
    }

    if (rec.discussionQuestions.length > 0) {
      lines.push("### Council Discussion Questions");
      for (const q of rec.discussionQuestions) {
        lines.push(`- ${q}`);
      }
      lines.push("");
    }

    if (rec.comparableCities && rec.comparableCities.length > 0) {
      lines.push("### Comparable Cities");
      for (const c of rec.comparableCities) {
        lines.push(`- ${c}`);
      }
      lines.push("");
    }

    if (rec.sourcesAnalyzed.length > 0) {
      lines.push("### Sources Analyzed");
      for (const s of rec.sourcesAnalyzed) {
        lines.push(`- ${s}`);
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "md";

  const recommendations = readRecommendations();
  const markdown = toMarkdown(recommendations);

  if (format === "md") {
    const filename = `civic-recommendations-${new Date().toISOString().split("T")[0]}.md`;
    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // format=pdf — serve an HTML page styled for print; browser triggers Save as PDF
  const html = buildPrintHTML(recommendations, markdown);
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// ─── Simple print-ready HTML for PDF export ──────────────────────────────────

function buildPrintHTML(recs: Recommendation[], _md: string): string {
  const now = new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "long",
    timeStyle: "short",
  });

  const rows = recs
    .map((rec, i) => {
      const badge =
        rec.severity === "high"
          ? `<span class="badge high">High</span>`
          : rec.severity === "low"
          ? `<span class="badge low">Low</span>`
          : `<span class="badge medium">Medium</span>`;

      const evidence =
        rec.evidence.length > 0
          ? `<h4>Evidence</h4><ul>${rec.evidence.map((e) => `<li>${e}</li>`).join("")}</ul>`
          : "";

      const questions =
        rec.discussionQuestions.length > 0
          ? `<h4>Council Discussion Questions</h4><ul>${rec.discussionQuestions.map((q) => `<li>${q}</li>`).join("")}</ul>`
          : "";

      const cities =
        rec.comparableCities && rec.comparableCities.length > 0
          ? `<h4>Comparable Cities</h4><ul>${rec.comparableCities.map((c) => `<li>${c}</li>`).join("")}</ul>`
          : "";

      const sources =
        rec.sourcesAnalyzed.length > 0
          ? `<h4>Sources Analyzed</h4><ul>${rec.sourcesAnalyzed.map((s) => `<li>${s}</li>`).join("")}</ul>`
          : "";

      return `
      <section class="rec">
        <div class="rec-header">
          <span class="rec-num">${i + 1}</span>
          <h2>${rec.title}</h2>
          ${badge}
        </div>
        <p class="meta">Generated ${rec.generatedAt}</p>
        <h4>Finding</h4>
        <p>${rec.finding}</p>
        <h4>Suggested Action</h4>
        <p>${rec.suggestedAction}</p>
        ${evidence}
        ${questions}
        ${cities}
        ${sources}
      </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Civic AI Recommendations</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; font-size: 12pt; color: #111; background: #fff; padding: 2cm; }
    h1 { font-size: 22pt; color: #1b2f5e; margin-bottom: 4pt; }
    .subtitle { font-size: 10pt; color: #555; margin-bottom: 6pt; }
    .disclaimer { font-size: 9pt; color: #c0392b; font-style: italic; margin-bottom: 20pt; }
    .rec { margin-bottom: 28pt; page-break-inside: avoid; border-top: 2px solid #1b2f5e; padding-top: 12pt; }
    .rec-header { display: flex; align-items: baseline; gap: 10pt; margin-bottom: 4pt; }
    .rec-num { font-size: 10pt; color: #888; }
    .rec-header h2 { font-size: 14pt; color: #1b2f5e; flex: 1; }
    .meta { font-size: 9pt; color: #888; margin-bottom: 8pt; }
    .badge { font-size: 9pt; font-weight: bold; padding: 2pt 6pt; border-radius: 4pt; }
    .badge.high { background: #fdecea; color: #c0392b; }
    .badge.medium { background: #fef9e7; color: #b7950b; }
    .badge.low { background: #eafaf1; color: #1d8348; }
    h4 { font-size: 10pt; font-weight: bold; color: #333; margin: 8pt 0 3pt; }
    p { font-size: 11pt; line-height: 1.5; }
    ul { padding-left: 16pt; }
    li { font-size: 10pt; line-height: 1.5; margin-bottom: 2pt; }
    @media print {
      body { padding: 1.5cm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>Civic AI Recommendations</h1>
  <p class="subtitle">Generated: ${now} CT &nbsp;·&nbsp; ${recs.length} recommendation${recs.length !== 1 ? "s" : ""}</p>
  <p class="disclaimer">All items require council review before any action is taken.</p>

  <div class="no-print" style="margin-bottom:20pt">
    <button onclick="window.print()" style="padding:8px 16px;background:#1b2f5e;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12pt">
      Print / Save as PDF
    </button>
  </div>

  ${rows.length ? rows : "<p><em>No recommendations available. Run an analysis first.</em></p>"}
</body>
</html>`;
}
