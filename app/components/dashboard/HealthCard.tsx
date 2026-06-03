"use client";

import { clsx } from "clsx";
import { ChevronRight, AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";
import type { RecommendationSeverity } from "@/types";

interface HealthCardProps {
  severity: RecommendationSeverity;
  title: string;
  finding: string;
  suggestedAction: string;
  generatedAt: string;
  onView: () => void;
}

const SEVERITY_CONFIG = {
  high: {
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700",
    icon: AlertCircle,
    iconColor: "text-red-500",
    label: "High Priority",
  },
  medium: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    label: "Medium Priority",
  },
  low: {
    bg: "bg-green-50",
    border: "border-green-200",
    badge: "bg-green-100 text-green-700",
    icon: CheckCircle,
    iconColor: "text-green-500",
    label: "For Review",
  },
};

export function HealthCard({
  severity,
  title,
  finding,
  suggestedAction,
  generatedAt,
  onView,
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
        <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(generatedAt)}</span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900 text-sm leading-snug">{title}</h3>

      {/* Finding */}
      <p className="text-sm text-gray-600 leading-relaxed">{finding}</p>

      {/* Suggested action */}
      <div className="bg-white/70 rounded-lg px-3 py-2 border border-white">
        <p className="text-xs font-semibold text-gray-500 mb-0.5">Suggested Action</p>
        <p className="text-sm text-gray-700">{suggestedAction}</p>
      </div>

      {/* View full analysis */}
      <button
        onClick={onView}
        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-city-navy transition-colors self-start"
      >
        View full analysis <ChevronRight size={12} />
      </button>
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
