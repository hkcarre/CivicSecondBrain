"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface CityTotal {
  cityName: string;
  messageCount: number;
}

// Single measure broken out by city — one hue for all bars (not per-city
// identity), per dataviz skill: nominal bars take the same slot-1 hue,
// never colored by their own value.
const BAR_LIGHT = "#081A33";
const BAR_DARK = "#8FA9C4";
const GRID_LIGHT = "#e5e7eb";
const GRID_DARK = "#374151";
const TEXT_LIGHT = "#9ca3af";
const TEXT_DARK = "#6b7280";

export function UsageByCityChart({ data }: { data: CityTotal[] }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- document is unavailable during SSR; must read post-mount
    setIsDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const barColor = isDark ? BAR_DARK : BAR_LIGHT;
  const gridColor = isDark ? GRID_DARK : GRID_LIGHT;
  const textColor = isDark ? TEXT_DARK : TEXT_LIGHT;

  if (data.length === 0) {
    return <div className="h-56 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">No usage yet.</div>;
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={gridColor} strokeWidth={1} />
          <XAxis dataKey="cityName" tickLine={false} axisLine={false} tick={{ fill: textColor, fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: textColor, fontSize: 11 }} width={32} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: gridColor, opacity: 0.4 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as CityTotal;
              return (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm px-3 py-2 text-xs">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{point.messageCount} messages</p>
                  <p className="text-gray-500 dark:text-gray-400 mt-0.5">{point.cityName}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="messageCount" radius={[4, 4, 0, 0]} maxBarSize={24}>
            {data.map((_, i) => (
              <Cell key={i} fill={barColor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
