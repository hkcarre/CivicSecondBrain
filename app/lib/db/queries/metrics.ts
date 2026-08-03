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
 */
export async function listAvailableMetrics(cityId: string): Promise<MetricSummary[]> {
  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("facts")
    .select("metric_id, metric_name, unit, period")
    .eq("city_id", cityId)
    .eq("flagged", false)
    .neq("review_status", "rejected")
    .order("period", { ascending: false });

  if (error) {
    throw new Error(`Failed to list available metrics: ${error.message}`);
  }

  const byMetric = new Map<string, MetricSummary>();
  for (const row of data ?? []) {
    const existing = byMetric.get(row.metric_id);
    if (!existing) {
      byMetric.set(row.metric_id, {
        metricId: row.metric_id,
        metricName: row.metric_name,
        unit: row.unit,
        periodCount: 1,
        latestPeriod: row.period,
      });
    } else {
      existing.periodCount++;
    }
  }
  return Array.from(byMetric.values());
}
