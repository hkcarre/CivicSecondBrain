/**
 * Regression test: empty assistant bubble when stream body is null
 *
 * When res.body is null (e.g. network edge case, some proxies), the prior
 * code did `return` silently, leaving an empty assistant message bubble in
 * state.  The fix populates that bubble with a user-friendly error string.
 *
 * This test validates the business logic in isolation (no React / jsdom
 * required) by simulating the reader-null branch that mirrors what
 * app/page.tsx now does.
 */

import { describe, it, expect } from "vitest";

// ─── Minimal replica of the state shape used in page.tsx ─────────────────────

type ChatMessage = { id: string; role: string; content: string };

const ERROR_TEXT = "Sorry, the response failed. Please try again.";

/**
 * handleStreamResponse mirrors the relevant branching logic from the
 * sendMessage() function in app/page.tsx.  It is intentionally kept
 * framework-free so that the regression can be exercised in a plain Node
 * Vitest environment without jsdom.
 *
 * Returns the final messages array after the fetch response is handled.
 */
async function handleStreamResponse(
  messages: ChatMessage[],
  res: { ok: boolean; body: ReadableStream<Uint8Array> | null; status?: number }
): Promise<{ messages: ChatMessage[]; isLoading: boolean; streamingId: string | null }> {
  let currentMessages = [...messages];
  let isLoading = false;
  let streamingId: string | null = null;

  if (!res.ok) {
    // Non-ok branch: throw so the outer catch handles it (matches page.tsx)
    throw new Error(`API error: ${res.status ?? "unknown"}`);
  }

  const assistantId = "assistant-msg-id";
  const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "" };
  currentMessages = [...currentMessages, assistantMsg];
  streamingId = assistantId;

  const reader = res.body?.getReader();

  if (!reader) {
    // THE FIX: populate content rather than silently return
    currentMessages = currentMessages.map((m) =>
      m.id === assistantId ? { ...m, content: ERROR_TEXT } : m
    );
    isLoading = false;
    streamingId = null;
    return { messages: currentMessages, isLoading, streamingId };
  }

  const decoder = new TextDecoder();
  let firstChunk = true;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (firstChunk) { isLoading = false; firstChunk = false; }
    currentMessages = currentMessages.map((m) =>
      m.id === assistantId ? { ...m, content: m.content + chunk } : m
    );
  }

  streamingId = null;
  isLoading = false;
  return { messages: currentMessages, isLoading, streamingId };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("chat stream null body regression", () => {
  it("populates assistant message with error text when res.body is null", async () => {
    const initial: ChatMessage[] = [{ id: "u1", role: "user", content: "Hello?" }];
    const fakeResponse = { ok: true, body: null };

    const result = await handleStreamResponse(initial, fakeResponse);

    // The assistant bubble must exist and carry the error message
    const assistantMsg = result.messages.find((m) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg!.content).toBe(ERROR_TEXT);

    // Loading and streaming state must be cleaned up
    expect(result.isLoading).toBe(false);
    expect(result.streamingId).toBeNull();
  });

  it("does NOT leave an empty assistant bubble when res.body is null", async () => {
    const initial: ChatMessage[] = [{ id: "u1", role: "user", content: "Hello?" }];
    const fakeResponse = { ok: true, body: null };

    const result = await handleStreamResponse(initial, fakeResponse);

    const assistantMsg = result.messages.find((m) => m.role === "assistant");
    expect(assistantMsg!.content).not.toBe("");
  });

  it("accumulates streamed chunks correctly when body is readable", async () => {
    const initial: ChatMessage[] = [{ id: "u1", role: "user", content: "What is 2+2?" }];

    // Create a simple ReadableStream that emits two text chunks
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("The answer is "));
        controller.enqueue(encoder.encode("4."));
        controller.close();
      },
    });

    const result = await handleStreamResponse(initial, { ok: true, body });

    const assistantMsg = result.messages.find((m) => m.role === "assistant");
    expect(assistantMsg!.content).toBe("The answer is 4.");
    expect(result.isLoading).toBe(false);
    expect(result.streamingId).toBeNull();
  });

  it("throws when response is not ok", async () => {
    const initial: ChatMessage[] = [{ id: "u1", role: "user", content: "Hello?" }];
    const fakeResponse = { ok: false, body: null, status: 500 };

    await expect(handleStreamResponse(initial, fakeResponse)).rejects.toThrow(
      "API error: 500"
    );
  });
});
