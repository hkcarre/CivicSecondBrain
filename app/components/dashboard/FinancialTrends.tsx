import { TrendingUp } from "lucide-react";
import { MetricLineChart } from "../charts/MetricLineChart";
import type { MetricSeries } from "@/lib/db/queries/metrics";

const VALUE_TYPE_LABEL: Record<MetricSeries["valueType"], string> = {
  adopted: "Adopted",
  amended: "Amended",
  actual: "Actual",
  estimate: "Estimate",
  projected: "Projected",
};

/**
 * Fixed decimal places for chart ticks/tooltips, inferred from magnitude
 * since metric_id isn't known ahead of time (this renders whatever facts
 * happen to exist for a city, not a hardcoded list). A tax rate like 0.5146
 * needs 4 places to be legible; a budget total in the millions needs 0-2.
 */
function inferDecimals(points: MetricSeries["points"]): number {
  const maxAbs = Math.max(0, ...points.map((p) => Math.abs(p.value)));
  if (maxAbs < 10) return 4;
  if (maxAbs < 1000) return 2;
  return 0;
}

/**
 * Numeric-facts trend cards — separate from the AI Recommendations section
 * below it, which reads narrative wiki content. This section reads only
 * from the curated facts query layer (app/lib/db/queries/metrics.ts),
 * never from markdown. Renders one card per approved (metric, value_type)
 * series for this city — not a hardcoded metric list, so a new metric
 * appears here automatically once facts exist for it.
 */
export function FinancialTrends({ series }: { series: MetricSeries[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {series.map((s) => (
        <div
          key={`${s.metricId}::${s.valueType}`}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-city-navy dark:text-city-maroon" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              {s.metricName}
            </h2>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            {VALUE_TYPE_LABEL[s.valueType]} · {s.unit} · {s.periodCount}{" "}
            {s.periodCount === 1 ? "period" : "periods"} on record
          </p>
          <MetricLineChart data={s.points} unit={s.unit} decimals={inferDecimals(s.points)} />
        </div>
      ))}
    </div>
  );
}
