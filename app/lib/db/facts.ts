/**
 * Supabase read/write helpers for the numeric facts table.
 * Server-only — uses the service-role client (bypasses RLS), same trust
 * boundary as the ingest pipeline generally.
 */

import { getServiceRoleClient } from "./supabase";
import type { NumericFact } from "../claude/fact-extraction-schema";

/**
 * Facts below this confidence are flagged for manual review (RLS hides them
 * from non-admin readers until approved — see
 * supabase/migrations/20260803010000_facts_review_gating.sql). Chosen
 * conservatively: civic financial figures reaching a public chart/dashboard
 * unreviewed is a real credibility risk, worth erring toward more review
 * rather than less.
 */
export const FLAG_CONFIDENCE_THRESHOLD = 0.75;

/**
 * Existing metric_ids already used for this city, for prompting the vision
 * extraction pass to reuse consistent slugs across documents/years rather
 * than fragmenting the same metric under near-duplicate ids (e.g.
 * "general-fund-revenue" vs "general-fund-revenues"). Capped at 200 —
 * plenty for prompt context without unbounded growth over years of history.
 */
export async function getExistingMetricIds(cityId: string): Promise<string[]> {
  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("facts")
    .select("metric_id")
    .eq("city_id", cityId)
    .limit(200);

  if (error) {
    console.warn("[facts] Failed to fetch existing metric_ids:", error.message);
    return [];
  }
  return Array.from(new Set((data ?? []).map((row) => row.metric_id as string)));
}

export interface UpsertFactsResult {
  written: number;
  flagged: number;
  duplicatesCollapsed: number;
}

/**
 * Upserts extracted facts into Supabase, keyed on the unique constraint
 * (city_id, metric_id, period, value_type, source_doc_id) — re-running
 * extraction on the same document safely overwrites rather than duplicates.
 *
 * A single document can yield two facts that resolve to the same conflict
 * key (e.g. the same figure shown in both a table and a chart on different
 * pages) — Postgres's ON CONFLICT can't update the same row twice in one
 * statement, so these must be deduped before the upsert, not just handled
 * by the DB constraint. When a genuine duplicate/disagreement occurs, the
 * higher-confidence extraction wins; if the two disagree in value, that's
 * flagged regardless of either individual confidence score, since
 * disagreement between two readings of the same document is itself a
 * reason for human review.
 */
export async function upsertFacts(
  cityId: string,
  sourceDocId: string,
  facts: NumericFact[]
): Promise<UpsertFactsResult> {
  if (facts.length === 0) return { written: 0, flagged: 0, duplicatesCollapsed: 0 };

  const byKey = new Map<string, NumericFact & { disagreement: boolean }>();
  let duplicatesCollapsed = 0;

  for (const fact of facts) {
    const key = `${fact.metric_id}::${fact.period}::${fact.value_type}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...fact, disagreement: false });
      continue;
    }
    duplicatesCollapsed++;
    const disagreement = existing.value !== fact.value || existing.disagreement;
    // Keep whichever reading has higher confidence, but carry the
    // disagreement flag forward regardless of which one wins.
    if (fact.confidence > existing.confidence) {
      byKey.set(key, { ...fact, disagreement });
    } else {
      byKey.set(key, { ...existing, disagreement });
    }
  }

  const client = getServiceRoleClient();
  const rows = Array.from(byKey.values()).map((f) => ({
    city_id: cityId,
    metric_id: f.metric_id,
    metric_name: f.metric_name,
    value: f.value,
    unit: f.unit,
    period: f.period,
    value_type: f.value_type,
    source_doc_id: sourceDocId,
    source_citation: f.source_citation,
    source_quote: f.source_quote ?? null,
    confidence: f.confidence,
    flagged: f.disagreement || f.confidence < FLAG_CONFIDENCE_THRESHOLD,
  }));

  const { error } = await client
    .from("facts")
    .upsert(rows, { onConflict: "city_id,metric_id,period,value_type,source_doc_id" });

  if (error) {
    throw new Error(`Failed to write facts to Supabase: ${error.message}`);
  }

  return {
    written: rows.length,
    flagged: rows.filter((r) => r.flagged).length,
    duplicatesCollapsed,
  };
}

export interface FlaggedFact {
  id: string;
  metricId: string;
  metricName: string;
  value: number;
  unit: string;
  period: string;
  valueType: string;
  sourceCitation: string;
  sourceQuote: string | null;
  confidence: number;
  createdAt: string;
}

/**
 * Facts held back from charts/chat pending human review — either
 * low-confidence or a disagreement between two readings of the same
 * document (see FLAG_CONFIDENCE_THRESHOLD above). Uses the service-role
 * client, same as the rest of this module: the /admin review UI is gated
 * by the shared-secret verifyReviewAccess() check (see app/lib/auth.ts),
 * not a per-user Supabase session, so there's no RLS-scoped client to use
 * here — this mirrors how ingest/lint/briefing already write facts.
 */
export async function listFlaggedFacts(cityId: string): Promise<FlaggedFact[]> {
  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("facts")
    .select(
      "id, metric_id, metric_name, value, unit, period, value_type, source_citation, source_quote, confidence, created_at"
    )
    .eq("city_id", cityId)
    .eq("flagged", true)
    .eq("review_status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list flagged facts: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    metricId: row.metric_id,
    metricName: row.metric_name,
    value: row.value,
    unit: row.unit,
    period: row.period,
    valueType: row.value_type,
    sourceCitation: row.source_citation,
    sourceQuote: row.source_quote,
    confidence: row.confidence,
    createdAt: row.created_at,
  }));
}

/**
 * Approves or rejects a flagged fact. Approving does NOT clear `flagged` —
 * the RLS policy and the app-level filter in queries/metrics.ts both treat
 * `review_status = 'approved'` as sufficient on its own (see the
 * 20260807000000 migration), so the flag stays as an honest record of why
 * this fact needed review in the first place.
 */
export async function reviewFact(factId: string, decision: "approve" | "reject"): Promise<boolean> {
  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("facts")
    .update({
      review_status: decision === "approve" ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", factId)
    .eq("review_status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to ${decision} fact ${factId}: ${error.message}`);
  }
  return data !== null;
}
