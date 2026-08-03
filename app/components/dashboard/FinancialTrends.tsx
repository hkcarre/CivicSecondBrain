import { TrendingUp } from "lucide-react";
import { MetricLineChart } from "../charts/MetricLineChart";
import type { MetricPoint } from "@/lib/db/queries/metrics";

export interface FinancialTrendsData {
  propertyTaxRate: MetricPoint[];
}

/**
 * Numeric-facts trend cards — separate from the AI Recommendations section
 * below it, which reads narrative wiki content. This section reads only
 * from the curated facts query layer (app/lib/db/queries/metrics.ts),
 * never from markdown.
 */
export function FinancialTrends({ data }: { data: FinancialTrendsData }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp size={16} className="text-city-navy dark:text-city-maroon" />
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
          Property Tax Rate
        </h2>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
        Per $100 valuation, adopted rate by fiscal year — sourced from official financial reports
      </p>
      <MetricLineChart data={data.propertyTaxRate} unit="per $100" decimals={4} />
    </div>
  );
}
