/**
 * Vision-based numeric extraction — the second, independent extraction pass
 * from the target architecture. Reads a document's actual PDF pages via
 * Claude's native multimodal input (tables/layout intact), rather than the
 * pre-flattened plain text the narrative INGEST pass works from
 * (app/lib/parser/pdf-parser.ts strips table structure entirely).
 *
 * This is the ONLY code path that writes to the `facts` table. Never derive
 * a numeric fact from the narrative pass's summarized prose — that
 * reintroduces the exact hallucination risk this separation exists to avoid.
 */

import fs from "fs";
import path from "path";
import { claude, VISION_EXTRACTION_SYSTEM_PROMPT, MODELS } from "./client";
import { parseVisionExtractionResult, type NumericFact } from "./fact-extraction-schema";
import { getExistingMetricIds, upsertFacts, type UpsertFactsResult } from "../db/facts";
import { getMaxFileSizeMb } from "../env";
import { withRetry } from "../ai/retry";
import type { CivicDocument } from "@/types";

/**
 * Claude's PDF input has its own size ceiling (32MB / ~100 pages) separate
 * from MAX_FILE_SIZE_MB (which bounds the narrative text-parsing pass).
 * Re-use the same env-configured cap for consistency — if a document was
 * already skipped for being oversized in the narrative pass, skip it here too.
 */
const MAX_PDF_BYTES = getMaxFileSizeMb() * 1024 * 1024;

export interface VisionExtractionOutcome {
  success: boolean;
  facts: NumericFact[];
  skipped?: "not-a-pdf" | "oversized";
  writeResult?: UpsertFactsResult;
}

/**
 * Runs the vision extraction pass on one document and writes any resulting
 * facts to Supabase. Non-throwing for expected skip cases (wrong format,
 * oversized); throws only for genuine failures (API error, schema
 * validation failure) so callers can decide how to handle/log those.
 */
export async function extractAndWriteFacts(
  doc: CivicDocument,
  cityId: string
): Promise<VisionExtractionOutcome> {
  if (!doc.localPath) {
    throw new Error(`No local path for document: ${doc.title}`);
  }

  if (path.extname(doc.localPath).toLowerCase() !== ".pdf") {
    // Tables live in PDFs for this corpus (budgets, financial reports).
    // HTML/DOCX/XLSX aren't handled by this pass yet.
    return { success: false, facts: [], skipped: "not-a-pdf" };
  }

  const stat = fs.statSync(doc.localPath);
  if (stat.size > MAX_PDF_BYTES) {
    console.warn(
      `  ⚠ Skipping vision extraction for oversized PDF (${Math.round(stat.size / 1024 / 1024)}MB): ${doc.title}`
    );
    return { success: false, facts: [], skipped: "oversized" };
  }

  const facts = await extractNumericFacts(doc, cityId);
  const writeResult = await upsertFacts(cityId, doc.id, facts);

  return { success: true, facts, writeResult };
}

async function extractNumericFacts(
  doc: CivicDocument,
  cityId: string
): Promise<NumericFact[]> {
  const pdfBuffer = fs.readFileSync(doc.localPath!);
  const pdfBase64 = pdfBuffer.toString("base64");

  const existingMetricIds = await getExistingMetricIds(cityId);
  const metricIdHint =
    existingMetricIds.length > 0
      ? `\n\nExisting metric_id values already used for ${doc.board ?? "this city"} — reuse one of these exactly when the same concept applies, rather than inventing a near-duplicate slug:\n${existingMetricIds.join(", ")}`
      : "";

  const response = await withRetry(
    () =>
      claude.messages.create({
        model: MODELS.sonnet, // precision matters here — a wrong number that reaches a chart is a worse cost than a cheaper model would save
        // Financial documents can carry many dozens of numeric facts —
        // 4096 truncated mid-array on a real "Financial Summary and
        // Charts" doc. 8192 gives headroom; the narrative INGEST pass
        // chunks its input for the same reason but numeric extraction
        // has no equivalent chunking yet (see TODO below).
        max_tokens: 8192,
        system: VISION_EXTRACTION_SYSTEM_PROMPT + metricIdHint,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64,
                },
              },
              {
                type: "text",
                text: `Document: ${doc.title}\nType: ${doc.type}\nDate: ${doc.date}\nSource: ${doc.sourceUrl}\n\nExtract every numeric fact from this document's tables and labeled figures, per the schema in your system instructions.`,
              },
            ],
          },
        ],
      }),
    {
      onRetry: (err, attempt, delayMs) =>
        console.warn(`[vision-extraction] transient error (retry ${attempt}, waiting ${delayMs}ms): ${(err as Error).message}`),
    }
  );

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Vision extraction returned no text content");
  }

  const jsonMatch =
    textBlock.text.match(/```json\n?([\s\S]+?)\n?```/) ??
    textBlock.text.match(/\{[\s\S]+\}/);
  if (!jsonMatch) {
    throw new Error("Vision extraction returned no parseable JSON");
  }

  const result = parseVisionExtractionResult(jsonMatch[jsonMatch.length - 1]);
  return result.facts;
}
