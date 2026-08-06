/**
 * INGEST operation — core engine
 *
 * Sends a parsed document to Claude, extracts structured knowledge,
 * and writes/updates the appropriate wiki pages.
 */

import { INGEST_SYSTEM_PROMPT } from "./client";
import { getAIProvider } from "../ai/provider";
import { readWikiPage } from "../wiki/reader";
import { queueForReview, type PendingAction, type IndexEntryInput } from "../wiki/pending-review";
import { parseDocument, chunkDocument } from "../parser/pdf-parser";
import type { CivicDocument, IngestResult } from "@/types";
import {
  parseExtractedKnowledge,
  type ExtractedKnowledge,
} from "./extraction-schema";

// ─── Main INGEST function ──────────────────────────────────────────────────

export async function ingestDocument(
  doc: CivicDocument
): Promise<IngestResult> {
  console.log(`\n📄 INGESTING: ${doc.title}`);
  const today = new Date().toISOString().split("T")[0];

  // 1. Parse the document text
  if (!doc.localPath) {
    throw new Error(`No local path for document: ${doc.title}`);
  }

  const parsed = await parseDocument(doc.localPath);

  // Guard: unsupported file formats (e.g. .docx, .xlsx) return skipped=true.
  // Do NOT call Claude or write any wiki pages for these — they have no text to extract.
  if (parsed.skipped) {
    console.warn(
      `  ⚠ Skipping unsupported format — no parser available for: ${doc.localPath}`
    );
    return {
      success: false,
      document: doc,
      pagesUpdated: [],
      pagesCreated: [],
      keyFacts: "",
      ordinancesReferenced: [],
      dollarAmounts: [],
      votesRecorded: 0,
      skipped: true,
    };
  }

  const chunks = chunkDocument(parsed.text);

  console.log(
    `  → ${parsed.pageCount ?? "?"} pages, ${chunks.length} chunk(s), ~${Math.round(parsed.text.length / 4)} tokens`
  );

  // 2. Extract structured knowledge via Claude
  // For multi-chunk documents, process each chunk and merge
  const allKnowledge: ExtractedKnowledge[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (chunks.length > 1) {
      console.log(`  → Processing chunk ${i + 1}/${chunks.length}...`);
    }

    const knowledge = await extractKnowledge(chunks[i], doc, i + 1, chunks.length);
    allKnowledge.push(knowledge);
  }

  // Merge multi-chunk results
  const merged = mergeKnowledge(allKnowledge);

  // 3. Determine which wiki pages would be updated — these are queued for
  // human review (see pending-review.ts), not written live. pagesUpdated/
  // pagesCreated below describe what's PENDING, matching this function's
  // existing return shape, not what's actually live yet.
  const pagesUpdated: string[] = [];
  const pagesCreated: string[] = [];
  const actions: PendingAction[] = [];

  // 4. For meeting minutes → queue a decisions page
  if (
    doc.type === "meeting-minutes" &&
    merged.keyDecisions.length > 0
  ) {
    const decisionsContent = buildDecisionsContent(merged, doc);
    const meetingDate = merged.documentDate || doc.date;
    const decisionSlug = (doc.board ?? "city-council").replace(/\s+/g, "-").toLowerCase();
    const decisionPath = `decisions/${meetingDate}-${decisionSlug}.md`;
    actions.push({
      kind: "create-decisions",
      meetingDate,
      board: doc.board ?? "city-council",
      content: decisionsContent,
      sources: [doc.title],
    });
    pagesCreated.push(decisionPath);
    console.log(`  ✓ Queued decisions page for review: ${decisionPath}`);
  }

  // 5. Queue updates to relevant topic pages
  for (const topic of merged.topicsAffected) {
    const topicPath = `topics/${topic}.md`;
    const topicPage = readWikiPage(topicPath);

    if (topicPage) {
      const updateContent = buildTopicUpdate(merged, doc, topic);
      actions.push({
        kind: "append-page",
        pagePath: topicPath,
        sectionHeading: `From ${doc.title} (${doc.date})`,
        content: updateContent,
        updatedDate: today,
      });
      pagesUpdated.push(topicPath);
      console.log(`  ✓ Queued topic update for review: ${topicPath}`);
    } else {
      // Queue a stub topic page if it doesn't exist yet
      const stubContent = buildTopicStub(merged, doc, topic);
      actions.push({
        kind: "create-page",
        page: {
          title: topicLabel(topic),
          type: "wiki",
          category: "topic",
          sources: [doc.title],
          lastUpdated: today,
          content: stubContent,
          path: topicPath,
        },
      });
      pagesCreated.push(topicPath);
      console.log(`  ✓ Queued topic stub for review: ${topicPath}`);
    }
  }

  // 6. Index entries for any newly-created pages — applied on approval,
  // alongside the actions above, not now.
  const newIndexEntries: IndexEntryInput[] = pagesCreated.map((p) => ({
    path: p,
    summary: merged.summary.slice(0, 80),
    date: today,
    sourceCount: 1,
    category: p.startsWith("decisions/")
      ? "decision"
      : p.startsWith("topics/")
      ? "topic"
      : "topic",
  }));

  // 7. Queue the log entry too — it should only land once this content is
  // actually live, not the moment extraction finishes.
  const logEntry = buildLogEntry(doc, merged, pagesUpdated, pagesCreated, today);

  queueForReview({
    title: doc.title,
    sourceUrl: doc.sourceUrl,
    preview: merged.summary,
    actions,
    indexEntries: newIndexEntries,
    logEntry,
  });

  console.log(
    `  ✅ INGEST complete — ${pagesUpdated.length} update(s), ${pagesCreated.length} new page(s) queued for review`
  );

  return {
    success: true,
    document: doc,
    pagesUpdated,
    pagesCreated,
    keyFacts: merged.keyFacts.join("; "),
    ordinancesReferenced: merged.ordinancesReferenced.map((o) => o.number),
    dollarAmounts: merged.dollarAmounts.map(
      (d) => `${d.description}: ${d.amount}${d.fiscalYear ? ` (${d.fiscalYear})` : ""}`
    ),
    votesRecorded: merged.keyDecisions.length,
  };
}

// ─── Extract knowledge from a document chunk ──────────────────────────────

async function extractKnowledge(
  text: string,
  doc: CivicDocument,
  chunkNum: number,
  totalChunks: number
): Promise<ExtractedKnowledge> {
  const chunkNote =
    totalChunks > 1 ? ` (chunk ${chunkNum} of ${totalChunks})` : "";

  const ai = getAIProvider();
  const responseText = await ai.complete({
    system: INGEST_SYSTEM_PROMPT,
    maxTokens: 4096,
    prompt: `Process this city document${chunkNote} and extract structured knowledge as JSON.

Document metadata:
- Title: ${doc.title}
- Type: ${doc.type}
- Date: ${doc.date}
- Board/Body: ${doc.board ?? "city-council"}
- Source: ${doc.sourceUrl}

Document text:
---
${text}
---

Return ONLY valid JSON matching the extraction schema. No prose.`,
  });

  // Extract JSON from response (may be wrapped in code fences)
  const jsonMatch =
    responseText.match(/```json\n?([\s\S]+?)\n?```/) ??
    responseText.match(/\{[\s\S]+\}/);

  if (!jsonMatch) {
    throw new Error("Claude returned no parseable JSON in INGEST response");
  }

  return parseExtractedKnowledge(jsonMatch[jsonMatch.length - 1]);
}

// ─── Merge knowledge from multiple chunks ─────────────────────────────────

function mergeKnowledge(chunks: ExtractedKnowledge[]): ExtractedKnowledge {
  if (chunks.length === 1) return chunks[0];

  const base = chunks[0];
  for (let i = 1; i < chunks.length; i++) {
    const c = chunks[i];
    base.keyDecisions.push(...c.keyDecisions);
    base.dollarAmounts.push(...c.dollarAmounts);
    base.ordinancesReferenced.push(...c.ordinancesReferenced);
    base.keyFacts.push(...c.keyFacts);
    base.openQuestions.push(...c.openQuestions);
    base.namedEntities.people.push(...c.namedEntities.people);

    // Merge topic lists (deduplicate)
    const topicSet = new Set([...base.topicsAffected, ...c.topicsAffected]);
    base.topicsAffected = Array.from(topicSet);
  }

  return base;
}

// ─── Wiki page content builders ────────────────────────────────────────────

function buildDecisionsContent(
  k: ExtractedKnowledge,
  doc: CivicDocument
): string {
  const lines: string[] = [];

  lines.push(`## Summary\n\n${k.summary}`);

  if (k.keyDecisions.length > 0) {
    lines.push("\n## Votes & Decisions\n");
    for (const d of k.keyDecisions) {
      lines.push(`### ${d.description}`);
      if (d.vote) lines.push(`**Result:** ${d.vote}`);
      if (d.ayes !== undefined)
        lines.push(`**Vote:** ${d.ayes} Ayes / ${d.noes ?? 0} Noes${d.abstentions ? ` / ${d.abstentions} Abstentions` : ""}`);
      if (d.ordinanceNumber)
        lines.push(`**Ordinance:** ${d.ordinanceNumber}`);
      lines.push(`[SOURCE: ${doc.title}]`);
      lines.push("");
    }
  }

  if (k.ordinancesReferenced.length > 0) {
    lines.push("## Ordinances Referenced\n");
    for (const o of k.ordinancesReferenced) {
      lines.push(`- **${o.number}** — ${o.title} (${o.action}) [SOURCE: ${doc.title}]`);
    }
  }

  if (k.dollarAmounts.length > 0) {
    lines.push("\n## Financial Items Discussed\n");
    for (const d of k.dollarAmounts) {
      const fy = d.fiscalYear ? ` (${d.fiscalYear})` : "";
      lines.push(`- ${d.description}: **${d.amount}${fy}** — ${d.context} [SOURCE: ${doc.title}]`);
    }
  }

  if (k.openQuestions.length > 0) {
    lines.push("\n## Open Items / Follow-up Needed\n");
    for (const q of k.openQuestions) {
      lines.push(`- ${q}`);
    }
  }

  return lines.join("\n");
}

function buildTopicUpdate(
  k: ExtractedKnowledge,
  doc: CivicDocument,
  topic: string
): string {
  // Match facts against the topic name with hyphens normalized to spaces
  // ("public-safety" → "public safety"). Facts that never mention the topic
  // belong on their own topic's page, not this one (#235). If nothing
  // matches, fall back to the leading facts so an update is never empty.
  const topicPhrase = topic.replaceAll("-", " ");
  const matchingFacts = k.keyFacts.filter((f) =>
    f.toLowerCase().includes(topicPhrase)
  );
  const relevantFacts = matchingFacts.length > 0 ? matchingFacts : k.keyFacts;

  const lines: string[] = [];

  lines.push(`*From: ${doc.title} (${doc.date})*\n`);

  for (const fact of relevantFacts.slice(0, 10)) {
    lines.push(`- ${fact} [SOURCE: ${doc.title}]`);
  }

  const relevantDollars = k.dollarAmounts.filter((d) =>
    d.context.toLowerCase().includes(topicPhrase)
  );
  for (const d of relevantDollars) {
    const fy = d.fiscalYear ? ` (${d.fiscalYear})` : "";
    lines.push(`- **${d.description}:** ${d.amount}${fy} [SOURCE: ${doc.title}]`);
  }

  return lines.join("\n");
}

function buildTopicStub(
  k: ExtractedKnowledge,
  doc: CivicDocument,
  topic: string
): string {
  return `## Overview

*This page is auto-generated from city documents. Last source: ${doc.title} (${doc.date})*

## Key Facts

${k.keyFacts
  .slice(0, 8)
  .map((f) => `- ${f} [SOURCE: ${doc.title}]`)
  .join("\n")}

## Related Pages

${k.topicsAffected
  .filter((t) => t !== topic)
  .map((t) => `- [[wiki/topics/${t}]]`)
  .join("\n")}
`;
}

function buildLogEntry(
  doc: CivicDocument,
  k: ExtractedKnowledge,
  pagesUpdated: string[],
  pagesCreated: string[],
  today: string
): string {
  return `## [${today}] INGEST | ${doc.title.slice(0, 60)}
**Source:** ${doc.sourceUrl}
**Document type:** ${doc.type}
**Pages updated:** ${pagesUpdated.join(", ") || "none"}
**Pages created:** ${pagesCreated.join(", ") || "none"}
**Key facts added:** ${k.summary}
**Ordinances referenced:** ${k.ordinancesReferenced.map((o) => o.number).join(", ") || "none"}
**Dollar amounts found:** ${k.dollarAmounts.map((d) => `${d.description}: ${d.amount}`).join("; ") || "none"}
**Votes recorded:** ${k.keyDecisions.length}`;
}

function topicLabel(topic: string): string {
  const labels: Record<string, string> = {
    budget: "Budget & Finance",
    ordinances: "Ordinances & City Code",
    infrastructure: "Infrastructure & Capital Improvements",
    "public-safety": "Public Safety",
    development: "Development & Zoning",
    governance: "Governance & Administration",
    "strategic-plan": "Strategic Plan",
  };
  return labels[topic] ?? topic;
}
