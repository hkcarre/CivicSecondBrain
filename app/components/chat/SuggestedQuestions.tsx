"use client";

import { Sparkles } from "lucide-react";
import { StrataLogoMark } from "../brand/StrataLogoMark";

const SUGGESTED_QUESTIONS = [
  "Summarize the most recent city council meeting",
  "What is the current total city debt and debt per capita?",
  "Which Strategic Plan goals are on track for 2025?",
  "What ordinances were passed in the last 90 days?",
  "How does this year's budget compare to last year?",
  "Which advisory boards haven't met recently?",
  "What capital improvement projects are funded for FY2025?",
  "What open records requests are currently pending?",
];

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Hero */}
      <div
        className="relative overflow-hidden text-center mb-8 rounded-3xl bg-city-cream dark:bg-gray-800/60 px-6 py-10 dot-grid"
      >
        <div className="relative">
          <div className="mx-auto mb-4 w-fit">
            <StrataLogoMark variant="brand" size={52} className="dark:hidden" />
            <StrataLogoMark variant="reversed" size={52} className="hidden dark:block text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-city-navy dark:text-white mb-2">
            Ask the City
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-sm max-w-md mx-auto">
            Ask anything about {process.env.NEXT_PUBLIC_CITY_NAME ?? "Schertz"}, {process.env.NEXT_PUBLIC_CITY_STATE ?? "TX"} — city finances, ordinances, meeting
            decisions, strategic goals.{" "}
            <span className="font-semibold text-city-navy dark:text-city-maroon-light">
              Every sentence is cited to the source.
            </span>
          </p>
        </div>
      </div>

      {/* Suggested questions */}
      <div>
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Sparkles size={12} />
          Suggested questions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => onSelect(q)}
              className="text-left text-sm px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-800 hover:border-city-navy/40 dark:hover:border-city-maroon/40
                         hover:bg-city-navy/5 dark:hover:bg-city-maroon/10
                         text-gray-700 dark:text-gray-300 hover:text-city-navy dark:hover:text-city-maroon
                         transition-all shadow-sm"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
