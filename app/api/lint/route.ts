/**
 * POST /api/lint
 * Triggers a wiki LINT + recommendation generation run.
 * Called from the Admin panel, or by AWS Lambda on schedule.
 */

import { NextResponse } from "next/server";
import { claude, MODELS, LINT_SYSTEM_PROMPT, CITY_FULL } from "@/lib/claude/client";
import { readFullWiki, buildWikiContext } from "@/lib/wiki/reader";
import { writeRecommendationPage, updateWikiIndex, appendToLog } from "@/lib/wiki/writer";
import type { Recommendation } from "@/types";

export const maxDuration = 300; // 5 minutes

export async function POST() {
  const today = new Date().toISOString().split("T")[0];

  try {
    // 1. Read full wiki
    const pages = readFullWiki();
    if (pages.length === 0) {
      return NextResponse.json({
        message: "No wiki pages found. Run ingest:seed first.",
        recommendations: 0,
      });
    }

    const wikiContext = buildWikiContext(pages, 80_000);
    const systemPrompt = LINT_SYSTEM_PROMPT.replace("{DATE}", today);

    // 2. Ask Claude to analyze and generate recommendations
    const response = await claude.messages.create({
      model: MODELS.sonnet,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Analyze the following ${CITY_FULL} wiki and generate civic recommendations.

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
${wikiContext}
---

Return ONLY valid JSON.`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
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

    // 4. Update index
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

    // 5. Log
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

    return NextResponse.json({
      message: `LINT complete. ${recs.length} recommendations generated.`,
      recommendations: recs.length,
      paths: newPaths,
    });
  } catch (err) {
    console.error("LINT error:", err);
    return NextResponse.json(
      { message: `Error: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
