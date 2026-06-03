"use client";

import { useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { clsx } from "clsx";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  placeholder = "Ask anything about Schertz, TX…",
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) onSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <div
          className={clsx(
            "flex items-end gap-2 rounded-2xl border bg-gray-50 px-4 py-2.5 transition-colors",
            isLoading
              ? "border-gray-200"
              : "border-gray-300 focus-within:border-city-navy focus-within:bg-white focus-within:shadow-sm"
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-800
                       placeholder:text-gray-400 min-h-[24px] max-h-[160px] py-0.5
                       disabled:opacity-50"
          />
          <button
            onClick={onSubmit}
            disabled={isLoading || !value.trim()}
            className={clsx(
              "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all",
              !isLoading && value.trim()
                ? "bg-city-navy text-white hover:bg-city-navy-light"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          Answers cite official Schertz city documents · Press Enter to send
        </p>
      </div>
    </div>
  );
}
