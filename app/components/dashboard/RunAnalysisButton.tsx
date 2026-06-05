"use client";

import { useState } from "react";
import { Play, Loader2, CheckCircle, XCircle, Download } from "lucide-react";

type Status = "idle" | "running" | "done" | "error";

export function RunAnalysisButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const run = async () => {
    setStatus("running");
    setMessage(null);
    try {
      const res = await fetch("/api/lint", { method: "POST" });
      const data = await res.json();
      setStatus(res.ok ? "done" : "error");
      setMessage(data.message ?? (res.ok ? "Analysis complete." : "Error."));
      // Refresh the page after a short delay so new recommendations appear
      if (res.ok) setTimeout(() => window.location.reload(), 1500);
    } catch {
      setStatus("error");
      setMessage("Network error — check server logs.");
    }
  };

  const exportMd = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export/recommendations?format=md");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match?.[1] ?? "civic-recommendations.md";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore — user will notice nothing happened
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={run}
          disabled={status === "running"}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-city-navy text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {status === "running" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Play size={13} />
          )}
          {status === "running" ? "Running analysis…" : "Run Analysis"}
        </button>

        <button
          onClick={exportMd}
          disabled={exporting}
          title="Download all recommendations as Markdown"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-all"
        >
          {exporting ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Download size={13} />
          )}
          Export
        </button>
      </div>

      {message && (
        <p
          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${
            status === "done"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {status === "done" ? (
            <CheckCircle size={11} />
          ) : (
            <XCircle size={11} />
          )}
          {message}
        </p>
      )}
    </div>
  );
}
