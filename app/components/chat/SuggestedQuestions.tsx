"use client";

import { Sparkles } from "lucide-react";

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
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-city-navy flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🏛</span>
        </div>
        <h1 className="text-2xl font-bold text-city-navy mb-2">
          Ask the City
        </h1>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          Ask anything about Schertz, TX — city finances, ordinances, meeting
          decisions, strategic goals. Every answer is cited from official documents.
        </p>
      </div>

      {/* Suggested questions */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Sparkles size={12} />
          Suggested questions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => onSelect(q)}
              className="text-left text-sm px-4 py-3 rounded-xl border border-gray-200
                         bg-white hover:border-city-navy/40 hover:bg-city-navy/5
                         text-gray-700 hover:text-city-navy transition-all shadow-sm"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
