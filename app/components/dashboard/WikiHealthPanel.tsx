"use client";

import { AlertTriangle, CheckCircle, Clock, FileText } from "lucide-react";
import { clsx } from "clsx";
import type { WikiHealthReport } from "@/types";

interface WikiHealthPanelProps {
  report: WikiHealthReport | null;
}

export function WikiHealthPanel({ report }: WikiHealthPanelProps) {
  if (!report) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Wiki Health</h2>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No LINT report yet. Health check runs nightly at 2:00 AM CT.
        </p>
      </div>
    );
  }

  const issues =
    report.stalePages.length +
    report.contradictions.length +
    report.missingDecisions.length +
    report.boardGaps.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Wiki Health</h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Last checked {formatDate(report.runAt)}
        </span>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat
          label="Pages"
          value={report.pagesAnalyzed}
          icon={FileText}
          color="blue"
        />
        <Stat
          label="Stale"
          value={report.stalePages.length}
          icon={Clock}
          color={report.stalePages.length > 0 ? "amber" : "green"}
        />
        <Stat
          label="Conflicts"
          value={report.contradictions.length}
          icon={AlertTriangle}
          color={report.contradictions.length > 0 ? "red" : "green"}
        />
        <Stat
          label="Board Gaps"
          value={report.boardGaps.length}
          icon={AlertTriangle}
          color={report.boardGaps.length > 3 ? "amber" : "green"}
        />
      </div>

      {/* Issues list */}
      {issues === 0 ? (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
          <CheckCircle size={15} />
          All wiki pages are current and consistent.
        </div>
      ) : (
        <div className="space-y-2">
          {report.stalePages.slice(0, 3).map((p) => (
            <Issue key={p} severity="medium" text={`Stale page: ${p}`} />
          ))}
          {report.contradictions.slice(0, 2).map((c, i) => (
            <Issue
              key={i}
              severity="high"
              text={`Contradiction: ${c.description}`}
            />
          ))}
          {report.boardGaps.slice(0, 3).map((b) => (
            <Issue key={b} severity="medium" text={`Board gap: ${b}`} />
          ))}
        </div>
      )}

      {/* Top actions */}
      {report.topActions.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
            Recommended Actions
          </p>
          <ol className="space-y-1">
            {report.topActions.map((action, i) => (
              <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
                <span className="text-gray-400 dark:text-gray-500 font-mono text-xs mt-0.5">
                  {i + 1}.
                </span>
                {action}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: "blue" | "amber" | "red" | "green";
}) {
  const colorMap = {
    blue: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30",
    red: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30",
    green: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30",
  };

  return (
    <div className={clsx("rounded-lg px-3 py-2 text-center", colorMap[color])}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs font-medium opacity-70">{label}</p>
    </div>
  );
}

function Issue({
  severity,
  text,
}: {
  severity: "high" | "medium";
  text: string;
}) {
  return (
    <div
      className={clsx(
        "flex items-start gap-2 text-xs px-3 py-2 rounded-lg",
        severity === "high"
          ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
          : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
      )}
    >
      <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
