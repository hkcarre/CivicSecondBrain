"use client";

import { useState } from "react";
import { Check, X, FileText, ExternalLink } from "lucide-react";
import type { PendingReviewItem, PendingAction } from "@/lib/wiki/pending-review";

function describeAction(action: PendingAction): string {
  switch (action.kind) {
    case "create-page":
      return `New page: ${action.page.path}`;
    case "create-decisions":
      return `New decisions page: ${action.board} — ${action.meetingDate}`;
    case "append-page":
      return `Update: ${action.pagePath}`;
    case "create-recommendation":
      return `New recommendation: ${action.recommendation.title}`;
  }
}

export function ReviewQueue({ initialItems }: { initialItems: PendingReviewItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/review/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Request failed (${res.status})`);
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          Nothing pending review right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
        >
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-city-navy dark:text-city-maroon flex-shrink-0" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {item.title}
                </h3>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Queued {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-gray-400 hover:text-city-navy"
                title="View source document"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{item.preview}</p>

          <div className="mb-3 space-y-1">
            {item.actions.map((action, i) => (
              <p
                key={i}
                className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded px-2 py-1"
              >
                {describeAction(action)}
              </p>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handle(item.id, "approve")}
              disabled={busyId === item.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-city-navy text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
            >
              <Check size={13} />
              Approve
            </button>
            <button
              onClick={() => handle(item.id, "reject")}
              disabled={busyId === item.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-all"
            >
              <X size={13} />
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
