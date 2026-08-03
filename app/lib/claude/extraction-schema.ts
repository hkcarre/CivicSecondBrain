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

const KeyDecisionSchema = z.object({
  description: z.string(),
  vote: z.string().optional(),
  ayes: z.number().optional(),
  noes: z.number().optional(),
  abstentions: z.number().optional(),
  ordinanceNumber: z.string().optional(),
});

const DollarAmountSchema = z.object({
  description: z.string(),
  amount: z.string(),
  fiscalYear: z.string().optional(),
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
  fiscalYear: z.string().optional(),
  board: z.string().optional(),
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
