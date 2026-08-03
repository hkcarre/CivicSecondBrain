"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { nanoid } from "nanoid";
import { ChatMessage } from "./components/chat/ChatMessage";
import { ChatInput } from "./components/chat/ChatInput";
import { TypingIndicator } from "./components/chat/TypingIndicator";
import { SuggestedQuestions } from "./components/chat/SuggestedQuestions";
import { ConversationSidebar } from "./components/chat/ConversationSidebar";
import type { ChatMessage as ChatMessageType } from "./types";

const STORAGE_KEY = "civic-chat-history";
const MAX_STORED_MESSAGES = 50;

function loadHistory(): ChatMessageType[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessageType[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_STORED_MESSAGES) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessageType[]): void {
  try {
    const capped = messages.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Storage unavailable — silent fail
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount — only relevant when there's no signed-in
  // Supabase session (local dev without auth configured, or Supabase not set
  // up yet). Once a real conversation is selected/created, Supabase persistence
  // takes over and this fallback is moot for that tab.
  useEffect(() => {
    const saved = loadHistory();
    if (saved.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is unavailable during SSR; must restore post-mount
      setMessages(saved);
      setSessionRestored(true);
    }
  }, []);

  // Hide "Session restored" banner after 3 seconds
  useEffect(() => {
    if (!sessionRestored) return;
    const timer = setTimeout(() => setSessionRestored(false), 3000);
    return () => clearTimeout(timer);
  }, [sessionRestored]);

  // Persist messages to localStorage on every update (skip during streaming, and
  // skip entirely once a real conversation is active — Supabase is the source of
  // truth then, and we don't want stale localStorage content bleeding into a
  // future signed-out session).
  useEffect(() => {
    if (streamingId !== null) return;
    if (activeConversationId !== null) return;
    if (messages.length === 0) return;
    saveHistory(messages);
  }, [messages, streamingId, activeConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, streamingId]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setSessionRestored(false);
    setActiveConversationId(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const handleSelectConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    setMessages([]);
    try {
      const res = await fetch(`/api/conversations/${id}/messages`);
      if (!res.ok) return;
      const { messages: stored } = await res.json();
      setMessages(
        stored.map((m: { id: string; role: string; content: string; createdAt: string }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
        }))
      );
    } catch {
      // Leave the (empty) message list — a brand-new conversation has none anyway.
    }
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessageType = {
      id: nanoid(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Lazily create a conversation on first message if the user hasn't
    // picked one from the sidebar yet — mirrors ChatGPT/Claude's "just
    // start typing" UX rather than forcing an explicit "New chat" click.
    // Silently no-ops (falls back to localStorage-only, as before) when
    // not signed in / Supabase isn't configured.
    let conversationId = activeConversationId;
    if (!conversationId) {
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: text.slice(0, 60) }),
        });
        if (res.ok) {
          const { conversation } = await res.json();
          conversationId = conversation.id;
          setActiveConversationId(conversation.id);
          setSidebarRefreshKey((k) => k + 1);
        }
      } catch {
        // Not signed in — proceed without persistence
      }
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          conversationId,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errBody.error ?? `API error: ${res.status}`);
      }

      const assistantId = nanoid();
      const assistantMsg: ChatMessageType = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };

      // Add the empty message and mark it as actively streaming.
      // Keep isLoading true and show the typing indicator until the first chunk.
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingId(assistantId);
      // isLoading stays true until first chunk arrives

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Sorry, the response failed. Please try again." }
              : m
          )
        );
        setIsLoading(false);
        setStreamingId(null);
        return;
      }

      let firstChunk = true;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        if (firstChunk) {
          // First content received — hide typing indicator, show the bubble
          setIsLoading(false);
          firstChunk = false;
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + chunk }
              : m
          )
        );
      }

      // Stream complete — allow "Save wiki" button to appear
      setStreamingId(null);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      setStreamingId(null);
      const errorMsg: ChatMessageType = {
        id: nanoid(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${(err as Error).message}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  }, [input, isLoading, messages, activeConversationId]);

  const handleFile = async (msg: ChatMessageType) => {
    try {
      await fetch("/api/chat/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, filed: true } : m))
      );
    } catch {
      // silent fail — filing is optional
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full">
      <ConversationSidebar
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        refreshKey={sidebarRefreshKey}
      />

      <div className="flex flex-col h-full flex-1 min-w-0">
        {/* Page header */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-3 md:py-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-city-navy">Ask the City</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Answers grounded in official {process.env.NEXT_PUBLIC_CITY_NAME ?? "Schertz"} city documents
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded hover:bg-gray-100"
                aria-label="Clear chat history"
              >
                Clear history
              </button>
            )}
          </div>
          {sessionRestored && (
            <div className="max-w-3xl mx-auto mt-2">
              <p className="text-xs text-emerald-600">Session restored</p>
            </div>
          )}
        </header>

        {/* Message area */}
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <SuggestedQuestions onSelect={(q) => { setInput(q); }} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onFile={handleFile}
                  isStreaming={msg.id === streamingId}
                />
              ))}
              {/* Show typing indicator while waiting for the first token */}
              {isLoading && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={sendMessage}
          isLoading={isLoading || streamingId !== null}
        />
      </div>
    </div>
  );
}
