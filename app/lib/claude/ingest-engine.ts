/**
 * INGEST operation — core engine
 *
 * Sends a parsed document to Claude, extracts structured knowledge,
 * and writes/updates the appropriate wiki pages.
 */

import { INGEST_SYSTEM_PROMPT } from "./client";
import { getAIProvider } from "../ai/provider";
import { readWikiPage, readWikiIndex } from "../wiki/reader";
import {
  writeWikiPage,
  writeDecisionsPage,
  appendToWikiPage,
  updateWikiIndex,
  appendToLog,
} from "../wiki/writer";
import { parseDocument, chunkDocument } from "../parser/pdf-parser";
import type { CivicDocument, IngestResult } from "@/types";

// ─── Structured extraction schema (returned by Claude) ────────────────────

interface ExtractedKnowledge {
  documentType: string;
  documentDate: string;
  fiscalYear?: string;
  board?: string;
  summary: string;
  keyDecisions: Array<{
    description: string;
    vote?: string;
    ayes?: number;
    noes?: number;
    abstentions?: number;
    ordinanceNumber?: string;
  }>;
  dollarAmounts: Array<{
    description: string;
    amount: string;
    fiscalYear?: string;
    context: string;
  }>;
  ordinancesReferenced: Array<{
    number: string;
    title: string;
    action: string;
  }>;
  namedEntities: {
    people: string[];
    departments: string[];
    locations: string[];
    externalOrgs: string[];
  };
  topicsAffected: string[];
  keyFacts: string[];
  openQuestions: string[];
}

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

  // 3. Determine which wiki pages to update
  const pagesUpdated: string[] = [];
  const pagesCreated: string[] = [];

  // 4. For meeting minutes → create decisions page
  if (
    doc.type === "meeting-minutes" &&
    merged.keyDecisions.length > 0
  ) {
    const decisionsContent = buildDecisionsContent(merged, doc);
    const decisionPath = writeDecisionsPage(
      merged.documentDate || doc.date,
      doc.board ?? "city-council",
      decisionsContent,
      [doc.title]
    );
    pagesCreated.push(decisionPath);
    console.log(`  ✓ Created decisions page: ${decisionPath}`);
  }

  // 5. Update relevant topic pages
  for (const topic of merged.topicsAffected) {
    const topicPath = `topics/${topic}.md`;
    const topicPage = readWikiPage(topicPath);

    if (topicPage) {
      const updateContent = buildTopicUpdate(merged, doc, topic);
      const updated = appendToWikiPage(
        topicPath,
        `From ${doc.title} (${doc.date})`,
        updateContent,
        today
      );
      if (updated) {
        pagesUpdated.push(topicPath);
        console.log(`  ✓ Updated topic: ${topicPath}`);
      }
    } else {
      // Create stub topic page if it doesn't exist
      const stubContent = buildTopicStub(merged, doc, topic);
      writeWikiPage({
        title: topicLabel(topic),
        type: "wiki",
        category: "topic",
        sources: [doc.title],
        lastUpdated: today,
        content: stubContent,
        path: topicPath,
      });
      pagesCreated.push(topicPath);
      console.log(`  ✓ Created topic stub: ${topicPath}`);
    }
  }

  // 6. Update wiki/index.md
  const newIndexEntries = [
    ...pagesCreated.map((p) => ({
      path: p,
      summary: merged.summary.slice(0, 80),
      date: today,
      sourceCount: 1,
      category: p.startsWith("decisions/")
        ? "decision"
        : p.startsWith("topics/")
        ? "topic"
        : "topic",
    })),
  ];

  if (newIndexEntries.length > 0) {
    updateWikiIndex(newIndexEntries);
  }

  // 7. Append to log
  const logEntry = buildLogEntry(doc, merged, pagesUpdated, pagesCreated, today);
  appendToLog(logEntry);

  console.log(
    `  ✅ INGEST complete — ${pagesUpdated.length} updated, ${pagesCreated.length} created`
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

  return JSON.parse(jsonMatch[jsonMatch.length - 1]) as ExtractedKnowledge;
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
  const relevantFacts = k.keyFacts.filter(
    (f) => f.toLowerCase().includes(topic.replace("-", " ")) || true
  );

  const lines: string[] = [];

  lines.push(`*From: ${doc.title} (${doc.date})*\n`);

  for (const fact of relevantFacts.slice(0, 10)) {
    lines.push(`- ${fact} [SOURCE: ${doc.title}]`);
  }

  const relevantDollars = k.dollarAmounts.filter((d) =>
    d.context.toLowerCase().includes(topic.replace("-", " "))
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
