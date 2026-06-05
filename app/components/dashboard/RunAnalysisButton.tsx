"use client";

import { useState } from "react";
import { Play, Loader2, CheckCircle, XCircle } from "lucide-react";

type Status = "idle" | "running" | "done" | "error";

export function RunAnalysisButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-2">
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
