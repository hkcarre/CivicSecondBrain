/**
 * Runtime schema for the vision-based numeric extraction pass.
 *
 * This is deliberately separate from extraction-schema.ts (the narrative
 * INGEST pass): per the architecture decision to keep numeric extraction
 * independent of narrative summarization, this pass re-derives numbers
 * directly from the document's tables/pages via vision input, never from
 * the narrative pass's prose output. See app/lib/claude/vision-extraction.ts.
 */

import { z } from "zod";

export const FACT_VALUE_TYPES = [
  "adopted",
  "amended",
  "actual",
  "estimate",
  "projected",
] as const;

// .optional() rejects an explicit JSON `null`, which models routinely emit
// for an inapplicable optional field instead of omitting the key (see the
// same fix, with the full incident writeup, in extraction-schema.ts).
// Normalizing to undefined here too, proactively, before it fails the same
// way this pass's sibling schema did.
const nullishToUndefined = <T>(v: T | null | undefined) => v ?? undefined;

const NumericFactSchema = z.object({
  metric_id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "metric_id must be a kebab-case slug"),
  metric_name: z.string(),
  value: z.number(),
  unit: z.string(),
  period: z.string(),
  value_type: z.enum(FACT_VALUE_TYPES),
  source_citation: z.string().min(1, "source_citation is required — never emit a number without one"),
  source_quote: z.string().nullish().transform(nullishToUndefined),
  confidence: z.number().min(0).max(1),
});

export const VisionExtractionResultSchema = z.object({
  facts: z.array(NumericFactSchema).default([]),
});

export type NumericFact = z.infer<typeof NumericFactSchema>;
export type VisionExtractionResult = z.infer<typeof VisionExtractionResultSchema>;

export function parseVisionExtractionResult(rawJson: string): VisionExtractionResult {
  try {
    const parsed = JSON.parse(rawJson);
    const result = VisionExtractionResultSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Vision extraction response failed schema validation: ${result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`
      );
    }
    return result.data;
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Response was cut off mid-array by max_tokens — a document with many
      // tables/pages can produce more facts than any fixed output budget
      // safely guarantees. Salvage whatever complete fact objects came
      // through before the cutoff rather than discarding the whole batch;
      // the truncated tail object (if any) is simply dropped.
      const salvaged = salvageTruncatedFacts(rawJson);
      console.warn(
        `[fact-extraction] Response was truncated (${err.message}) — salvaged ${salvaged.length} complete fact(s) from before the cutoff.`
      );
      return { facts: salvaged };
    }
    throw err;
  }
}

/** Extracts and validates complete top-level `{...}` objects from inside a (possibly truncated) `"facts": [...]` array, dropping any that fail to parse or validate. */
function salvageTruncatedFacts(rawJson: string): NumericFact[] {
  const arrayStart = rawJson.indexOf("[");
  if (arrayStart === -1) return [];

  const objects: string[] = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escape = false;

  for (let i = arrayStart; i < rawJson.length; i++) {
    const ch = rawJson[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        objects.push(rawJson.slice(objStart, i + 1));
        objStart = -1;
      }
    }
  }

  const facts: NumericFact[] = [];
  for (const objText of objects) {
    try {
      const parsed = NumericFactSchema.safeParse(JSON.parse(objText));
      if (parsed.success) facts.push(parsed.data);
    } catch {
      // Incomplete/malformed object at the truncation boundary — skip it.
    }
  }
  return facts;
}
