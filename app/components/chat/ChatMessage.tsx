"use client";

import type { ReactNode } from "react";
import { User, Bot, BookMarked, AlertTriangle, Volume2, VolumeX } from "lucide-react";
import { clsx } from "clsx";
import type { ChatMessage as ChatMessageType } from "@/types";
import { useSpeechSynthesis } from "@/lib/hooks/useSpeechSynthesis";

interface ChatMessageProps {
  message: ChatMessageType;
  onFile?: (message: ChatMessageType) => void;
  isStreaming?: boolean;
}

export function ChatMessage({ message, onFile, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === "user";
  const speech = useSpeechSynthesis();

  const handleReadAloud = () => {
    if (speech.isSpeaking) {
      speech.stop();
    } else {
      speech.speak(message.content);
    }
  };

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
            : "bg-city-maroon/20 text-city-navy dark:text-city-maroon border border-city-maroon/30"
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
          <span className="inline-block w-2 h-4 bg-city-navy/60 dark:bg-city-maroon/60 animate-pulse rounded-sm ml-0.5 align-middle" />
        )}

        {/* Actions for assistant messages — only shown after stream is complete */}
        {!isUser && !isStreaming && (onFile || speech.isSupported) && (
          <div className="mt-3 flex items-center gap-3">
            {onFile && !message.filed && (
              <button
                onClick={() => onFile(message)}
                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              >
                <BookMarked size={12} />
                Save answer to wiki
              </button>
            )}
            {speech.isSupported && (
              <button
                onClick={handleReadAloud}
                aria-label={speech.isSpeaking ? "Stop reading aloud" : "Read answer aloud"}
                className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {speech.isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                {speech.isSpeaking ? "Stop" : "Read aloud"}
              </button>
            )}
          </div>
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
        return <span key={i}>{renderInlineMarkdown(part.text, `md-${i}`)}</span>;
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
  const remaining = content;

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

// Link URL is restricted to relative paths or https:// (no javascript:/data:
// schemes, no quote/angle-bracket characters) — but the real safety property
// here isn't the regex, it's that every piece goes through JSX as a prop or
// child rather than being concatenated into an HTML string. This text is
// LLM-generated (and the model may echo attacker-influenced document
// content it was told to treat as data, not instructions — see the SECURITY
// preambles in claude/client.ts), so building raw HTML + dangerouslySetInnerHTML
// here previously meant a quote character in a "safe-looking" https:// URL
// could break out of the href attribute. Real elements can't do that: React
// escapes every prop and child value it renders, so there's no string to
// break out of.
const INLINE_MARKDOWN_PATTERN =
  /\[([^\]]+)\]\((\/[\w\-./]*|https:\/\/[^\s)"'<>]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\n/g;

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = new RegExp(INLINE_MARKDOWN_PATTERN);
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const [full, linkLabel, linkUrl, bold, italic, code] = match;
    if (linkUrl !== undefined) {
      const external = linkUrl.startsWith("http");
      nodes.push(
        <a
          key={`${keyPrefix}-${key++}`}
          href={linkUrl}
          className="text-city-navy dark:text-city-maroon underline hover:no-underline"
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
        >
          {linkLabel}
        </a>
      );
    } else if (bold !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${key++}`}>{bold}</strong>);
    } else if (italic !== undefined) {
      nodes.push(<em key={`${keyPrefix}-${key++}`}>{italic}</em>);
    } else if (code !== undefined) {
      nodes.push(
        <code
          key={`${keyPrefix}-${key++}`}
          className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs font-mono"
        >
          {code}
        </code>
      );
    } else if (full === "\n") {
      nodes.push(<br key={`${keyPrefix}-${key++}`} />);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
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
