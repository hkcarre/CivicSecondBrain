"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { nanoid } from "nanoid";
import { ChatMessage } from "./components/chat/ChatMessage";
import { ChatInput } from "./components/chat/ChatInput";
import { TypingIndicator } from "./components/chat/TypingIndicator";
import { SuggestedQuestions } from "./components/chat/SuggestedQuestions";
import type { ChatMessage as ChatMessageType } from "./types";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, streamingId]);

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

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
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
  }, [input, isLoading, messages]);

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
    <div className="flex flex-col h-full">
      {/* Page header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-lg font-semibold text-city-navy">Ask the City</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Answers grounded in official Schertz city documents
          </p>
        </div>
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
  );
}
