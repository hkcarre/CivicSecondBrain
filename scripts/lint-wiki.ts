#!/usr/bin/env tsx
/**
 * lint-wiki.ts
 *
 * WIKI LINT — Reads the full wiki, sends it to Claude for analysis,
 * and generates AI recommendation pages on the dashboard.
 *
 * Usage:
 *   npm run lint:wiki
 */

import { claude, MODELS, LINT_SYSTEM_PROMPT } from "../app/lib/claude/client";
import { readFullWiki, buildWikiContext } from "../app/lib/wiki/reader";
import { writeRecommendationPage, updateWikiIndex, appendToLog } from "../app/lib/wiki/writer";
import type { Recommendation } from "../app/types";

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  CivicSecondBrain — Wiki Health Check & Lint");
  console.log("═══════════════════════════════════════════════════\n");

  const today = new Date().toISOString().split("T")[0];

  // 1. Read full wiki
  const pages = readFullWiki();
  if (pages.length === 0) {
    console.log("⚠  No wiki pages found. Run npm run ingest:seed first.");
    process.exit(0);
  }

  console.log(`📖 Analyzing ${pages.length} wiki pages...\n`);
  const wikiContext = buildWikiContext(pages);
  const systemPrompt = LINT_SYSTEM_PROMPT.replace("{DATE}", today);

  // 2. Ask Claude to analyze and generate recommendations
  const response = await claude.messages.create({
    model: MODELS.sonnet,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Analyze the following Schertz, TX wiki and generate civic recommendations.

Return a JSON object with:
{
  "recommendations": [
    {
      "title": "...",
      "severity": "high|medium|low",
      "finding": "...",
      "evidence": ["...", "..."],
      "comparableCities": ["..."],
      "suggestedAction": "...",
      "discussionQuestions": ["...", "..."],
      "sourcesAnalyzed": ["wiki/topics/budget.md"]
    }
  ],
  "stalePages": ["..."],
  "topActions": ["...", "...", "..."]
}

Wiki content:
---
${wikiContext.slice(0, 150000)}
---

Return ONLY valid JSON.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch =
    text.match(/```json\n?([\s\S]+?)\n?```/) ?? text.match(/\{[\s\S]+\}/);

  if (!jsonMatch) {
    throw new Error("Claude returned no parseable JSON");
  }

  const result = JSON.parse(jsonMatch[jsonMatch.length - 1]);
  const recs: Recommendation[] = (result.recommendations ?? []).map(
    (r: Recommendation) => ({
      ...r,
      id: `${today}-${r.title.slice(0, 20).replace(/\s/g, "-").toLowerCase()}`,
      generatedAt: today,
      path: "",
    })
  );

  // 3. Write recommendation pages
  const newPaths: string[] = [];
  for (const rec of recs) {
    const p = writeRecommendationPage(rec);
    rec.path = p;
    newPaths.push(p);
  }

  // 4. Update wiki index
  if (newPaths.length > 0) {
    updateWikiIndex(
      newPaths.map((p, i) => ({
        path: p,
        summary: recs[i].finding.slice(0, 80),
        date: today,
        sourceCount: recs[i].sourcesAnalyzed.length,
        category: "recommendation",
      }))
    );
  }

  // 5. Append to log
  appendToLog(`## [${today}] LINT | full
**Pages analyzed:** ${pages.length}
**Issues found:** ${recs.filter((r) => r.severity === "high").length} high | ${recs.filter((r) => r.severity === "medium").length} medium | ${recs.filter((r) => r.severity === "low").length} low
**Stale pages:** ${(result.stalePages ?? []).join(", ") || "none"}
**Recommendations generated:** ${newPaths.join(", ") || "none"}
**Top 3 recommended actions:**
${(result.topActions ?? [])
  .slice(0, 3)
  .map((a: string, i: number) => `  ${i + 1}. ${a}`)
  .join("\n")}`);

  // 6. Print summary
  console.log("═══════════════════════════════════════════════════");
  console.log("  LINT COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Pages analyzed:       ${pages.length}`);
  console.log(`  High priority issues: ${recs.filter((r) => r.severity === "high").length}`);
  console.log(`  Medium issues:        ${recs.filter((r) => r.severity === "medium").length}`);
  console.log(`  Low issues:           ${recs.filter((r) => r.severity === "low").length}`);
  console.log(`  Stale pages:          ${(result.stalePages ?? []).length}`);
  console.log(`  Recommendations:      ${newPaths.length}`);

  if (result.topActions?.length) {
    console.log("\n📋 Top recommended actions:");
    (result.topActions as string[]).slice(0, 3).forEach((a, i) => {
      console.log(`  ${i + 1}. ${a}`);
    });
  }

  console.log(`\n✓ Recommendations written to wiki/recommendations/`);
  console.log("  View on the dashboard: /dashboard\n");
}

main().catch((err) => {
  console.error("\n✗ Fatal error:", err.message);
  process.exit(1);
});
