/**
 * Builds the exact system prompt /api/chat sends to the model.
 *
 * Extracted out of the route handler so scripts/eval-chat.ts's red-team
 * suite exercises the real assembly instead of a hand-rolled copy — that
 * copy already drifted from production once (the structured-facts block
 * and the chart-pointer instruction were both added to the route without
 * eval-chat.ts ever being updated to match, so the "5/5 passing" eval
 * result silently stopped meaning anything about the live prompt). A
 * shared function makes that class of drift impossible: change this once,
 * both callers pick it up.
 */

import { QUERY_SYSTEM_PROMPT } from "@/lib/claude/client";
import {
  readWikiIndex,
  readRelevantPages,
  buildWikiContext,
} from "@/lib/wiki/reader";
import { selectRelevantPages } from "@/lib/wiki/select";
import { getCurrentCityId } from "@/lib/db/cities";
import { getAllMetricSeries, selectRelevantMetrics, type MetricSeries } from "@/lib/db/queries/metrics";

const VALUE_TYPE_LABEL: Record<MetricSeries["valueType"], string> = {
  adopted: "Adopted",
  amended: "Amended",
  actual: "Actual",
  estimate: "Estimate",
  projected: "Projected",
};

/**
 * Chat previously only ever answered numeric questions by re-deriving
 * figures from narrative wiki prose — a completely separate extraction
 * pass from the one that populates the `facts` table the dashboard's
 * charts read from (see vision-extraction.ts's own comment on why the two
 * are kept independent). The two could disagree. This gives chat access to
 * the same precise, reviewed numbers the charts use, so both surfaces cite
 * the same source of truth for a given figure.
 *
 * Fails silently to "" — numeric facts are a separately-configured layer
 * (Supabase) on top of the wiki chat otherwise reads from; a deployment
 * without it configured, or a city with no facts extracted yet, should
 * still get a working chat answer from wiki content alone.
 */
async function buildStructuredFactsBlock(userMessage: string): Promise<string> {
  try {
    const cityId = await getCurrentCityId();
    const allSeries = await getAllMetricSeries(cityId);
    const relevant = selectRelevantMetrics(userMessage, allSeries);
    if (relevant.length === 0) return "";

    const sections = relevant.map((s) => {
      const rows = s.points
        .map(
          (p) =>
            `- ${p.period}: ${p.value} ${p.unit} [SOURCE: ${p.sourceCitation}]`
        )
        .join("\n");
      return `### ${s.metricName} (${VALUE_TYPE_LABEL[s.valueType]})\n${rows}`;
    });

    return (
      "\n\n## STRUCTURED FACTS (verified numeric data — prefer these exact " +
      "figures and citations over any number mentioned in the wiki text " +
      "below when both cover the same thing)\n\n" +
      sections.join("\n\n")
    );
  } catch (err) {
    console.warn("[chat] Structured facts unavailable:", (err as Error).message);
    return "";
  }
}

export interface ChatSystemPromptResult {
  system: string;
  relevantPaths: string[];
  wikiPageCount: number;
}

export async function buildChatSystemPrompt(
  userMessage: string,
  today: string
): Promise<ChatSystemPromptResult> {
  const indexEntries = readWikiIndex();
  const relevantPaths = selectRelevantPages(userMessage, indexEntries);
  const wikiPages = readRelevantPages(relevantPaths);
  const wikiContext = buildWikiContext(wikiPages, 40_000);

  const systemPrompt = QUERY_SYSTEM_PROMPT.replace("{DATE}", today);
  const structuredFactsBlock = await buildStructuredFactsBlock(userMessage);

  const contextBlock =
    wikiPages.length > 0
      ? `\n\n## WIKI KNOWLEDGE BASE\n\nThe following wiki pages are relevant to this query:\n\n${wikiContext}`
      : "\n\n## WIKI KNOWLEDGE BASE\n\nNo wiki pages have been ingested yet. " +
        "Run `npm run ingest:seed` to populate the knowledge base.";

  // Placed after contextBlock (up to 40K chars of wiki text) rather than
  // inside structuredFactsBlock — an instruction buried mid-prompt, ahead
  // of a large context dump, was reliably getting ignored in practice.
  // Recency matters for instruction-following; putting it last and making
  // it an imperative fixed that.
  const chartPointer = structuredFactsBlock
    ? "\n\n## IMPORTANT — CHART/GRAPH REQUESTS\nThis chat is text-only and " +
      "cannot render a chart, even though the STRUCTURED FACTS above are " +
      "chartable. If the user's question asks for a chart, graph, plot, " +
      "or visualization, your answer MUST end with this exact line, " +
      "including the markdown link exactly as written (the chat UI " +
      "renders [text](/path) as a clickable link): " +
      "\"You can see this as an interactive chart on your " +
      "[City Health dashboard](/dashboard).\""
    : "";

  return {
    system: systemPrompt + structuredFactsBlock + contextBlock + chartPointer,
    relevantPaths,
    wikiPageCount: wikiPages.length,
  };
}
