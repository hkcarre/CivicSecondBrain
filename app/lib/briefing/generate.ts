/**
 * app/lib/briefing/generate.ts
 *
 * BRIEFING operation — auto-generate a pre-meeting briefing packet from a
 * published council/board agenda:
 *
 *   1. Download + parse the agenda document (reuses the scraper/parser
 *      machinery; the temp file is deleted after parsing).
 *   2. One AI call to extract the agenda item list [{number, title, summary}],
 *      capped at MAX_BRIEFING_ITEMS (cost guard).
 *   3. Per item: TF-IDF-select relevant wiki pages (same selector as chat)
 *      and one AI call to write the item brief — background, related
 *      decisions/ordinances, budget implications, open questions.
 *   4. Compose one markdown packet, save to wiki/briefings/, update the
 *      index, and append to the log.
 */

import fs from "fs";
import { getAIProvider } from "@/lib/ai/provider";
import {
  BRIEFING_EXTRACT_SYSTEM_PROMPT,
  BRIEFING_ITEM_SYSTEM_PROMPT,
  CITY_FULL,
} from "@/lib/claude/client";
import { downloadDocument } from "@/lib/scraper/schertz-scraper";
import { parseDocument } from "@/lib/parser/pdf-parser";
import {
  readWikiIndex,
  readRelevantPages,
  buildWikiContext,
} from "@/lib/wiki/reader";
import { selectRelevantPages } from "@/lib/wiki/select";
import {
  writeBriefingPage,
  updateWikiIndex,
  appendToLog,
} from "@/lib/wiki/writer";
import {
  BriefingGenerationError,
  ITEM_CONTEXT_TOKENS,
  MAX_AGENDA_CHARS,
  MAX_BRIEFING_ITEMS,
  boardLabel,
  composeBriefingPacket,
  parseAgendaExtraction,
  slugify,
  type BriefingInput,
} from "./helpers";
import type { AgendaItem, BriefingResult } from "@/types";

export async function generateBriefing(
  input: BriefingInput
): Promise<BriefingResult> {
  const today = new Date().toISOString().split("T")[0];

  // ── 1. Download + parse the agenda ──────────────────────────────────────
  const agendaText = await fetchAgendaText(input, today);

  // ── 2. Extract the agenda item list (one AI call) ───────────────────────
  const ai = getAIProvider();
  const extractResponse = await ai.complete({
    system: BRIEFING_EXTRACT_SYSTEM_PROMPT,
    maxTokens: 4096,
    prompt: `Extract the agenda items from this ${CITY_FULL} meeting agenda.

Agenda text:
---
${agendaText}
---

Return ONLY valid JSON.`,
  });

  const extraction = parseAgendaExtraction(extractResponse);
  if (extraction.items.length === 0) {
    throw new BriefingGenerationError(
      "No agenda items could be extracted from the document.",
      422
    );
  }

  const totalItems = extraction.items.length;
  const items = extraction.items.slice(0, MAX_BRIEFING_ITEMS);
  const meetingDate = input.meetingDate ?? extraction.meetingDate ?? today;
  const extractedSlug = extraction.board ? slugify(extraction.board) : "";
  const resolvedBoard = input.board ?? (extractedSlug || "city-council");

  // ── 3. Per-item wiki cross-reference + brief (one AI call per item) ─────
  const indexEntries = readWikiIndex();
  const briefs: string[] = [];
  const pagesConsulted = new Set<string>();
  const itemSystemPrompt = BRIEFING_ITEM_SYSTEM_PROMPT.replace("{DATE}", today);

  for (const item of items) {
    const relevantPaths = selectRelevantPages(
      `${item.title} ${item.summary}`,
      indexEntries
    );
    relevantPaths.forEach((p) => pagesConsulted.add(p));
    const wikiPages = readRelevantPages(relevantPaths);
    // Bounded per-item context (~10k chars of wiki content)
    const wikiContext = buildWikiContext(wikiPages, ITEM_CONTEXT_TOKENS);

    try {
      const brief = await ai.complete({
        system: itemSystemPrompt,
        maxTokens: 1500,
        prompt: buildItemPrompt(item, wikiContext),
      });
      briefs.push(brief.trim());
    } catch (err) {
      // One flaky call should not discard the rest of the packet.
      briefs.push(
        `_Brief generation failed for this item: ${(err as Error).message}_`
      );
    }
  }

  // ── 4. Compose, save, index, log ────────────────────────────────────────
  const markdown = composeBriefingPacket({
    meetingDate,
    boardSlug: resolvedBoard,
    agendaUrl: input.agendaUrl,
    items,
    briefs,
    totalItems,
  });

  const title = `Meeting Briefing Packet — ${boardLabel(resolvedBoard)} — ${meetingDate}`;
  const pagePath = writeBriefingPage(
    meetingDate,
    resolvedBoard,
    title,
    markdown,
    [input.agendaUrl]
  );

  updateWikiIndex([
    {
      path: pagePath,
      summary: `Briefing packet: ${items.length} agenda item${items.length !== 1 ? "s" : ""} for ${meetingDate} ${boardLabel(resolvedBoard)} meeting`,
      date: today,
      sourceCount: 1,
      category: "briefing",
    },
  ]);

  appendToLog(`## [${today}] BRIEFING | ${meetingDate} ${resolvedBoard}
**Agenda:** ${input.agendaUrl}
**Items briefed:** ${items.length} of ${totalItems}${totalItems > items.length ? ` (capped at ${MAX_BRIEFING_ITEMS})` : ""}
**Wiki pages consulted:** ${[...pagesConsulted].join(", ") || "none"}
**Packet:** ${pagePath}`);

  return {
    path: pagePath,
    itemCount: items.length,
    totalItems,
    truncated: totalItems > items.length,
    markdown,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function fetchAgendaText(
  input: BriefingInput,
  today: string
): Promise<string> {
  const localPath = await downloadDocument({
    title: `Agenda: ${input.agendaUrl}`,
    url: input.agendaUrl,
    type: "agenda",
    date: input.meetingDate ?? today,
  });

  if (!localPath) {
    throw new BriefingGenerationError(
      "Agenda download failed. Check the URL and try again.",
      502
    );
  }

  try {
    const parsed = await parseDocument(localPath);
    if (parsed.skipped || !parsed.text.trim()) {
      throw new BriefingGenerationError(
        "Could not extract text from the agenda document (unsupported format or empty file).",
        422
      );
    }
    return parsed.text.slice(0, MAX_AGENDA_CHARS);
  } catch (err) {
    if (err instanceof BriefingGenerationError) throw err;
    throw new BriefingGenerationError(
      `Agenda parsing failed: ${(err as Error).message}`,
      422
    );
  } finally {
    // The raw agenda file is only needed for this run — delete it.
    try {
      fs.unlinkSync(localPath);
    } catch {
      // Cleanup failures are non-fatal.
    }
  }
}

function buildItemPrompt(item: AgendaItem, wikiContext: string): string {
  const contextBlock = wikiContext.trim()
    ? `Relevant wiki pages:\n---\n${wikiContext}\n---`
    : "Relevant wiki pages: none found in the knowledge base for this item.";

  return `Agenda item ${item.number}: ${item.title}
${item.summary ? `Item summary: ${item.summary}\n` : ""}
${contextBlock}

Write the briefing for this agenda item.`;
}
