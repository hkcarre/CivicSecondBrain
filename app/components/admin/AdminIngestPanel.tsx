"use client";

import { useState } from "react";
import { RefreshCw, Play, FileSearch, CheckCircle, Loader2 } from "lucide-react";
import { clsx } from "clsx";

interface AdminIngestPanelProps {
  stats: {
    pagesTotal: number;
    lastIngest: string | null;
    lastLint: string | null;
  };
  logSummary: string;
}

export function AdminIngestPanel({ stats, logSummary }: AdminIngestPanelProps) {
  const [status, setStatus] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [result, setResult] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const run = async (action: "ingest" | "lint" | "scrape-check") => {
    setStatus("running");
    setActiveAction(action);
    setResult(null);

    try {
      const res = await fetch(`/api/${action}`, { method: "POST" });
      const data = await res.json();
      setStatus("done");
      setResult(data.message ?? "Complete.");
    } catch (err) {
      setStatus("error");
      setResult("Error — check server logs.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Knowledge Base</h2>
        <div className="space-y-2 text-sm">
          <Row label="Wiki pages" value={stats.pagesTotal} />
          <Row
            label="Last ingest"
            value={stats.lastIngest ?? "Never"}
          />
          <Row
            label="Last lint"
            value={stats.lastLint ?? "Never"}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Actions</h2>
        <div className="space-y-2">
          <ActionButton
            icon={RefreshCw}
            label="Check for new documents"
            description="Scrape schertz.com, no ingest"
            active={activeAction === "scrape-check" && status === "running"}
            onClick={() => run("scrape-check")}
            disabled={status === "running"}
          />
          <ActionButton
            icon={Play}
            label="Run ingestion"
            description="Process pending documents"
            active={activeAction === "ingest" && status === "running"}
            onClick={() => run("ingest")}
            disabled={status === "running"}
            primary
          />
          <ActionButton
            icon={FileSearch}
            label="Run wiki LINT"
            description="Health check + recommendations"
            active={activeAction === "lint" && status === "running"}
            onClick={() => run("lint")}
            disabled={status === "running"}
          />
        </div>

        {/* Result */}
        {result && (
          <div
            className={clsx(
              "mt-3 text-xs px-3 py-2 rounded-lg flex items-center gap-2",
              status === "done"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            )}
          >
            <CheckCircle size={12} />
            {result}
          </div>
        )}
      </div>

      {/* Log preview */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-2">Recent Log</h2>
        <pre className="text-xs text-gray-500 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-48">
          {logSummary || "No log entries yet."}
        </pre>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  description,
  active,
  onClick,
  disabled,
  primary = false,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all",
        primary
          ? "bg-city-navy text-white border-city-navy hover:bg-city-navy-light disabled:opacity-50"
          : "bg-white text-gray-700 border-gray-200 hover:border-city-navy/40 hover:bg-gray-50 disabled:opacity-50"
      )}
    >
      {active ? (
        <Loader2 size={15} className="animate-spin flex-shrink-0" />
      ) : (
        <Icon size={15} className="flex-shrink-0" />
      )}
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className={clsx("text-xs", primary ? "text-white/70" : "text-gray-400")}>
          {description}
        </p>
      </div>
    </button>
  );
}
