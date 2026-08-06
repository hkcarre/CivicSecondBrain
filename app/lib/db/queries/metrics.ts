/**
 * Curated read layer over the `facts` table — the ONLY sanctioned way any
 * chart, dashboard, or insight in the app should read numeric data. Never
 * query `facts` directly from a component or route; add a named function
 * here instead.
 *
 * Why this exists (not just RLS): RLS keeps a user from reading another
 * city's or an unreviewed fact's row, but it doesn't stop a caller from
 * silently mixing incompatible `value_type`s in one series (adopted budget
 * next to actuals reads as a real trend line but isn't one). These
 * functions default to `actual` and require the caller to opt in
 * explicitly to anything else, so that decision is made once, here, not
 * re-litigated per chart.
 *
 * Server-only — uses the service-role client directly for now (no
 * end-user auth/session exists yet in the app; see TODO in
 * app/lib/db/cities.ts). Once real auth ships, swap the client here for
 * the RLS-scoped browser client without changing any caller.
 */

import { getServiceRoleClient } from "../supabase";
import type { FACT_VALUE_TYPES } from "../../claude/fact-extraction-schema";
import { tokenise, buildIdf, tfidfVector, cosine } from "../../wiki/select";

export type FactValueType = (typeof FACT_VALUE_TYPES)[number];

export interface MetricPoint {
  period: string;
  value: number;
  unit: string;
  valueType: FactValueType;
  confidence: number;
  sourceCitation: string;
}

export interface MetricSummary {
  metricId: string;
  metricName: string;
  unit: string;
  valueType: FactValueType;
  periodCount: number;
  latestPeriod: string;
}

/**
 * One metric's time series for a single, explicit value_type — e.g. the
 * "actual" property tax rate across every period on record. Never mixes
 * value_types within the returned array; call it twice (and render two
 * clearly-labeled series) if you need e.g. adopted vs. actual compared.
 *
 * Only unflagged, non-rejected facts are returned — anything pending
 * review or flagged for disagreement stays out of charts until approved
 * (mirrors the RLS policy; enforced here too since this uses the
 * service-role client, which bypasses RLS).
 */
export async function getMetricSeries(
  cityId: string,
  metricId: string,
  valueType: FactValueType = "actual"
): Promise<MetricPoint[]> {
  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("facts")
    .select("period, value, unit, value_type, confidence, source_citation")
    .eq("city_id", cityId)
    .eq("metric_id", metricId)
    .eq("value_type", valueType)
    .eq("flagged", false)
    .neq("review_status", "rejected")
    .order("period", { ascending: true });

  if (error) {
    throw new Error(`Failed to read metric series for "${metricId}": ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    period: row.period,
    value: row.value,
    unit: row.unit,
    valueType: row.value_type as FactValueType,
    confidence: row.confidence,
    sourceCitation: row.source_citation,
  }));
}

/**
 * Discovers what's queryable for a city — for a metric picker UI, or to
 * decide what to chart on a dashboard without hardcoding metric_ids.
 *
 * Grouped by (metric_id, value_type), not metric_id alone: a metric with
 * both "adopted" and "actual" rows is two distinct, non-mixable series (see
 * the module-level comment on why value_type is never conflated), so each
 * needs its own summary entry and its own call to getMetricSeries().
 */
export async function listAvailableMetrics(cityId: string): Promise<MetricSummary[]> {
  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("facts")
    .select("metric_id, metric_name, unit, value_type, period")
    .eq("city_id", cityId)
    .eq("flagged", false)
    .neq("review_status", "rejected")
    .order("period", { ascending: false });

  if (error) {
    throw new Error(`Failed to list available metrics: ${error.message}`);
  }

  const byMetric = new Map<string, MetricSummary>();
  for (const row of data ?? []) {
    const key = `${row.metric_id}::${row.value_type}`;
    const existing = byMetric.get(key);
    if (!existing) {
      byMetric.set(key, {
        metricId: row.metric_id,
        metricName: row.metric_name,
        unit: row.unit,
        valueType: row.value_type as FactValueType,
        periodCount: 1,
        latestPeriod: row.period,
      });
    } else {
      existing.periodCount++;
    }
  }
  return Array.from(byMetric.values());
}

/**
 * Every queryable metric series for a city, ready to chart — combines
 * listAvailableMetrics() with a getMetricSeries() call per (metric,
 * value_type) pair. This is the one function a dashboard/grid should call;
 * it keeps the "never mix value_types" rule enforced in one place rather
 * than every caller re-implementing the same loop.
 */
export interface MetricSeries extends MetricSummary {
  points: MetricPoint[];
}

export async function getAllMetricSeries(cityId: string): Promise<MetricSeries[]> {
  const summaries = await listAvailableMetrics(cityId);
  const series = await Promise.all(
    summaries.map(async (summary) => ({
      ...summary,
      points: await getMetricSeries(cityId, summary.metricId, summary.valueType),
    }))
  );
  // Series with the longest history first — the most substantive trend
  // lines lead, single-point "series" (nothing to trend yet) trail.
  return series.sort((a, b) => b.periodCount - a.periodCount);
}

const METRIC_SCORE_THRESHOLD = 0.05; // same threshold selectRelevantPages uses
const METRIC_TOP_K = 3; // small on purpose — a chat answer citing 3 precise figures beats one citing 8

/**
 * Scores a city's metric series against a free-text question using the same
 * TF-IDF/cosine approach selectRelevantPages() uses for wiki pages (see
 * app/lib/wiki/select.ts) — reused rather than reimplemented so both
 * selectors behave consistently. Lets chat answer numeric questions from
 * the same precise, reviewed facts table the dashboard's charts read from,
 * instead of only ever re-deriving numbers from narrative wiki prose (the
 * two pipelines extract independently and could otherwise disagree).
 */
export function selectRelevantMetrics(
  query: string,
  allSeries: MetricSeries[]
): MetricSeries[] {
  if (allSeries.length === 0) return [];

  const queryTokens = tokenise(query);
  const seriesTexts = allSeries.map((s) => tokenise(`${s.metricName} ${s.metricId}`));
  const idf = buildIdf([queryTokens, ...seriesTexts]);
  const queryVec = tfidfVector(queryTokens, idf);

  return allSeries
    .map((series, i) => ({
      series,
      score: cosine(queryVec, tfidfVector(seriesTexts[i], idf)),
    }))
    .filter((s) => s.score >= METRIC_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, METRIC_TOP_K)
    .map((s) => s.series);
}
