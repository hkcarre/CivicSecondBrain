"use client";

import { User, Bot, BookMarked, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";
import type { ChatMessage as ChatMessageType } from "@/types";

interface ChatMessageProps {
  message: ChatMessageType;
  onFile?: (message: ChatMessageType) => void;
  isStreaming?: boolean;
}

export function ChatMessage({ message, onFile, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={clsx(
        "flex gap-3 message-enter",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
          isUser
            ? "bg-city-navy text-white"
            : "bg-city-gold/20 text-city-navy dark:text-city-gold border border-city-gold/30"
        )}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      {/* Bubble */}
      <div
        className={clsx(
          "max-w-[78%] rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "bg-city-navy text-white rounded-tr-sm"
            : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm shadow-sm"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <AssistantContent content={message.content} />
        )}

        {/* Streaming cursor — visible while response is still generating */}
        {!isUser && isStreaming && (
          <span className="inline-block w-2 h-4 bg-city-navy/60 dark:bg-city-gold/60 animate-pulse rounded-sm ml-0.5 align-middle" />
        )}

        {/* Actions for assistant messages — only shown after stream is complete */}
        {!isUser && !isStreaming && onFile && !message.filed && (
          <button
            onClick={() => onFile(message)}
            className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            <BookMarked size={12} />
            Save answer to wiki
          </button>
        )}

        {message.filed && (
          <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <BookMarked size={12} />
            Saved to wiki/queries/
          </p>
        )}

        {/* Timestamp */}
        <p
          className={clsx(
            "text-xs mt-1.5",
            isUser ? "text-white/50 text-right" : "text-gray-400 dark:text-gray-500"
          )}
        >
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

// ─── Render assistant content with citation highlighting ──────────────────

function AssistantContent({ content }: { content: string }) {
  // Split on [SOURCE: ...] citations and ⚠️ AI ANALYSIS blocks
  const parts = parseContent(content);

  return (
    <div className="prose-civic">
      {parts.map((part, i) => {
        if (part.type === "citation") {
          return (
            <span key={i} className="citation">
              📎 {part.text}
            </span>
          );
        }
        if (part.type === "ai-analysis") {
          return (
            <div key={i} className="ai-analysis">
              <div className="flex items-center gap-1.5 font-semibold mb-1">
                <AlertTriangle size={14} />
                AI ANALYSIS — Requires Council Review
              </div>
              <span>{part.text}</span>
            </div>
          );
        }
        // Plain text — render simple markdown-like formatting
        return (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(part.text) }}
          />
        );
      })}
    </div>
  );
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "citation"; text: string }
  | { type: "ai-analysis"; text: string };

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  let remaining = content;

  // Handle AI ANALYSIS blocks first
  const aiPattern = /⚠️ AI ANALYSIS[^\n]*\n?([\s\S]*?)(?=\n\n|\[SOURCE|$)/g;
  const citationPattern = /\[SOURCE:[^\]]+\]/g;

  // Simple sequential parser
  const tokens = remaining.split(/(\[SOURCE:[^\]]+\]|⚠️ AI ANALYSIS[^\n]*)/g);

  for (const token of tokens) {
    if (token.startsWith("[SOURCE:")) {
      parts.push({ type: "citation", text: token.slice(1, -1) });
    } else if (token.startsWith("⚠️ AI ANALYSIS")) {
      parts.push({ type: "ai-analysis", text: token.replace(/^⚠️ AI ANALYSIS[^\n]*\n?/, "") });
    } else if (token.trim()) {
      parts.push({ type: "text", text: token });
    }
  }

  return parts;
}

function renderInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/\n/g, "<br>");
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
