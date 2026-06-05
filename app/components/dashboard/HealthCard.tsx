"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ChevronRight, AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";
import type { RecommendationSeverity } from "@/types";

interface HealthCardProps {
  severity: RecommendationSeverity;
  title: string;
  finding: string;
  suggestedAction: string;
  generatedAt: string;
  path?: string;
}

const SEVERITY_CONFIG = {
  high: {
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800",
    badge: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
    icon: AlertCircle,
    iconColor: "text-red-500 dark:text-red-400",
    label: "High Priority",
  },
  medium: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    icon: AlertTriangle,
    iconColor: "text-amber-500 dark:text-amber-400",
    label: "Medium Priority",
  },
  low: {
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800",
    badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
    icon: CheckCircle,
    iconColor: "text-green-500 dark:text-green-400",
    label: "For Review",
  },
};

export function HealthCard({
  severity,
  title,
  finding,
  suggestedAction,
  generatedAt,
  path,
}: HealthCardProps) {
  const cfg = SEVERITY_CONFIG[severity];
  const Icon = cfg.icon;

  return (
    <div
      className={clsx(
        "rounded-xl border p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow",
        cfg.bg,
        cfg.border
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={18} className={cfg.iconColor} />
          <span className={clsx("text-xs font-semibold px-2 py-0.5 rounded-full", cfg.badge)}>
            {cfg.label}
          </span>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{formatDate(generatedAt)}</span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug">{title}</h3>

      {/* Finding */}
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{finding}</p>

      {/* Suggested action */}
      <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg px-3 py-2 border border-white dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Suggested Action</p>
        <p className="text-sm text-gray-700 dark:text-gray-300">{suggestedAction}</p>
      </div>

      {/* View full analysis */}
      {path && (
        <Link
          href={`/wiki/${encodeURIComponent(path.replace(/\.md$/, ""))}`}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-city-navy dark:hover:text-city-gold transition-colors self-start"
        >
          View full analysis <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
