"use client";

import { useState } from "react";
import { CheckCircle, Clock, ExternalLink } from "lucide-react";
import type { CivicDocument } from "@/types";

interface ManifestTableProps {
  documents: CivicDocument[];
}

export function ManifestTable({ documents }: ManifestTableProps) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [boardFilter, setBoardFilter] = useState("all");

  const types = ["all", ...Array.from(new Set(documents.map((d) => d.type))).sort()];
  const boards = [
    "all",
    ...Array.from(new Set(documents.map((d) => d.board ?? "general"))).sort(),
  ];

  const filtered = documents.filter((d) => {
    if (typeFilter !== "all" && d.type !== typeFilter) return false;
    if (boardFilter !== "all" && (d.board ?? "general") !== boardFilter)
      return false;
    return true;
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 min-w-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 flex-wrap">
        <h2 className="font-semibold text-gray-900 mr-auto">
          Document Manifest
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({filtered.length} of {documents.length})
          </span>
        </h2>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-city-navy"
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {t === "all" ? "All types" : t}
            </option>
          ))}
        </select>

        <select
          value={boardFilter}
          onChange={(e) => setBoardFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-city-navy"
        >
          {boards.map((b) => (
            <option key={b} value={b}>
              {b === "all" ? "All boards" : b}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-400">
          No documents match the current filters.
        </div>
      ) : (
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Document</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900 truncate max-w-[240px]">
                      {doc.title}
                    </p>
                    {doc.board && (
                      <p className="text-xs text-gray-400">{doc.board}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {doc.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {doc.date}
                  </td>
                  <td className="px-4 py-2.5">
                    <IngestStatus doc={doc} />
                  </td>
                  <td className="px-4 py-2.5">
                    <a
                      href={doc.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 inline-flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IngestStatus({ doc }: { doc: CivicDocument }) {
  if (doc.ingestedAt) {
    return (
      <div className="flex items-center gap-1 text-green-600 text-xs">
        <CheckCircle size={12} />
        <span>Ingested {doc.ingestedAt.split("T")[0]}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-amber-600 text-xs">
      <Clock size={12} />
      <span>Pending</span>
    </div>
  );
}
