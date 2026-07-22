/**
 * POST /api/lint
 * Triggers a wiki LINT + recommendation generation run.
 * Called from the Admin panel, or by AWS Lambda on schedule.
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { LINT_SYSTEM_PROMPT, CITY_FULL } from "@/lib/claude/client";
import { parseLintResponse } from "@/lib/claude/lint-parse";
import { getAIProvider } from "@/lib/ai/provider";
import { readFullWiki, buildWikiContext } from "@/lib/wiki/reader";
import { writeRecommendationPage, updateWikiIndex, appendToLog } from "@/lib/wiki/writer";
import type { Recommendation } from "@/types";
import { verifyIngestAccess } from "@/lib/auth";

export const maxDuration = 300; // 5 minutes

export async function POST(req: Request) {
  if (!(await verifyIngestAccess(req))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

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

    // 2. Use AI provider to analyze and generate recommendations
    const ai = getAIProvider();
    const text = await ai.complete({
      system: systemPrompt,
      // 16k output: with a rich context (post-#257) 8k truncated the JSON
      // mid-array (#262). The prompt also caps recommendation count below.
      maxTokens: 16384,
      prompt: `Analyze the following ${CITY_FULL} wiki and generate civic recommendations.

Return AT MOST 5 recommendations — choose the highest-impact findings. Keep "finding" and "suggestedAction" concise (2-3 sentences each).

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
    });

    // Truncation-tolerant: salvages complete recommendation objects when the
    // response exceeds the output cap and the JSON is cut off (#262).
    const result = parseLintResponse(text);
    if (result.truncated) {
      console.warn(
        `[lint] Response truncated — salvaged ${result.recommendations.length} complete recommendation(s).`
      );
    }
    const recs: Recommendation[] = (result.recommendations as Recommendation[]).map(
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

    // Bust the dashboard ISR cache so recommendations appear immediately
    revalidatePath("/dashboard");

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
