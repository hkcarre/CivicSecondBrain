"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MetricPoint } from "@/lib/db/queries/metrics";

interface MetricLineChartProps {
  data: MetricPoint[];
  unit: string;
  /**
   * Fixed decimal places for ticks/tooltip (e.g. 4 for a tax rate like
   * 0.5146). A plain number, not a formatter function — this component can
   * be rendered from a server component (see FinancialTrends.tsx), and
   * Next.js can't serialize a function prop across that boundary.
   */
  decimals?: number;
}

// Single-series chart: one hue, no legend needed (the card title names the
// series) — per dataviz skill, a categorical palette/legend is only
// required at 2+ series. Official Strata brand colors: Deep Navy in light
// mode, Light Blue (the brand's own dark-surface-friendly accent) in dark.
const LINE_COLOR_LIGHT = "#081A33"; // city-navy (Deep Navy)
const LINE_COLOR_DARK = "#8FA9C4"; // city-light-blue
const GRID_COLOR_LIGHT = "#e5e7eb"; // gray-200, one step off white surface
const GRID_COLOR_DARK = "#374151"; // gray-700, one step off gray-900 surface
const TEXT_MUTED_LIGHT = "#9ca3af"; // gray-400
const TEXT_MUTED_DARK = "#6b7280"; // gray-500

export function MetricLineChart({ data, unit, decimals = 2 }: MetricLineChartProps) {
  const [isDark, setIsDark] = useState(false);
  const formatValue = (value: number) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- document is unavailable during SSR; must read post-mount
    setIsDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const lineColor = isDark ? LINE_COLOR_DARK : LINE_COLOR_LIGHT;
  const gridColor = isDark ? GRID_COLOR_DARK : GRID_COLOR_LIGHT;
  const textColor = isDark ? TEXT_MUTED_DARK : TEXT_MUTED_LIGHT;

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        No data yet for this metric.
      </div>
    );
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={gridColor} strokeWidth={1} />
          <XAxis
            dataKey="period"
            tickLine={false}
            axisLine={false}
            tick={{ fill: textColor, fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: textColor, fontSize: 11 }}
            tickFormatter={formatValue}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: gridColor, strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as MetricPoint;
              return (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm px-3 py-2 text-xs">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatValue(point.value)} {unit}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                    {point.period} · {point.valueType}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={lineColor}
            fillOpacity={0.1}
            dot={false}
            activeDot={{ r: 5, fill: lineColor, stroke: isDark ? "#1f2937" : "#ffffff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
