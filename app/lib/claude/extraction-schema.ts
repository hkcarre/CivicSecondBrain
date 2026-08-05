/**
 * Runtime schema for the INGEST engine's LLM output.
 *
 * The model's JSON response is untrusted output: it can be malformed,
 * missing fields, or (since it's derived from scraped third-party
 * documents) shaped by content an attacker embedded in a source PDF/HTML
 * page. Every field is validated and coerced to a safe shape before it is
 * allowed to reach the wiki writer — nothing downstream should ever see an
 * unparsed `as ExtractedKnowledge` cast again.
 */

import { z } from "zod";

/**
 * `.optional()` accepts `undefined` (or an omitted key) but rejects an
 * explicit JSON `null` — and Claude routinely emits `null` for
 * inapplicable optional fields rather than omitting the key, since the
 * prompt lists a fixed JSON shape for it to fill in. That mismatch was
 * silently failing every real INGEST response that hit it (100% of
 * production ingests since the guardrail was added — a document with zero
 * optional fields present is effectively never). This normalizes null
 * back to undefined so the *output* type stays exactly what callers
 * already expect (`T | undefined`, never `T | null`), while the *input*
 * tolerates whatever shape the model actually sends.
 */
function nullishOptional<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullish().transform((v) => v ?? undefined);
}

const KeyDecisionSchema = z.object({
  description: z.string(),
  vote: nullishOptional(z.string()),
  ayes: nullishOptional(z.number()),
  noes: nullishOptional(z.number()),
  abstentions: nullishOptional(z.number()),
  ordinanceNumber: nullishOptional(z.string()),
});

const DollarAmountSchema = z.object({
  description: z.string(),
  // The prompt asks for a formatted amount but doesn't mandate a string
  // shape, and Claude legitimately returns a bare number for some
  // documents (e.g. a plain rate/dollar figure with no "$"/"M" to
  // include). Accept either, normalize to string for downstream code
  // that interpolates it directly (wiki writer, log entries).
  amount: z.union([z.string(), z.number()]).transform(String),
  fiscalYear: nullishOptional(z.string()),
  context: z.string(),
});

const OrdinanceReferencedSchema = z.object({
  number: z.string(),
  title: z.string(),
  action: z.string(),
});

const NamedEntitiesSchema = z.object({
  people: z.array(z.string()).default([]),
  departments: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  externalOrgs: z.array(z.string()).default([]),
});

export const ExtractedKnowledgeSchema = z.object({
  documentType: z.string(),
  documentDate: z.string(),
  fiscalYear: nullishOptional(z.string()),
  board: nullishOptional(z.string()),
  summary: z.string(),
  keyDecisions: z.array(KeyDecisionSchema).default([]),
  dollarAmounts: z.array(DollarAmountSchema).default([]),
  ordinancesReferenced: z.array(OrdinanceReferencedSchema).default([]),
  namedEntities: NamedEntitiesSchema.default({
    people: [],
    departments: [],
    locations: [],
    externalOrgs: [],
  }),
  topicsAffected: z.array(z.string()).default([]),
  keyFacts: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
});

export type ExtractedKnowledge = z.infer<typeof ExtractedKnowledgeSchema>;

/**
 * Parses and validates a raw JSON string from the INGEST model call.
 * Throws a descriptive error (caught by the ingest pipeline's per-document
 * error handling) rather than letting an unvalidated shape reach the wiki.
 */
export function parseExtractedKnowledge(rawJson: string): ExtractedKnowledge {
  const parsed = JSON.parse(rawJson);
  const result = ExtractedKnowledgeSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `INGEST response failed schema validation: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }
  return result.data;
}
