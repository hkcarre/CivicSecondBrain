/**
 * ai-provider.test.ts
 *
 * Tests the provider factory routing, singleton, reset, model resolution,
 * HMR-safe globalThis caching, and transient-error retry integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAIProvider, resetAIProvider } from "@/lib/ai/provider";

// ─── Shared mock instances ────────────────────────────────────────────────

const mockAnthropicCreate = vi.fn();
const mockOpenAICreate = vi.fn();

// ─── Mock SDKs before provider is imported ────────────────────────────────

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: mockAnthropicCreate,
    };
  },
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockOpenAICreate,
      },
    };
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────

describe("AI provider factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAIProvider();
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_BASE_URL;

    // Default mock return values
    mockAnthropicCreate.mockImplementation(({ stream }: { stream?: boolean }) => {
      if (stream) {
        return Promise.resolve(
          (async function* () {
            yield { type: "content_block_delta", delta: { type: "text_delta", text: "ant" } };
            yield { type: "content_block_delta", delta: { type: "text_delta", text: "hropic" } };
          })()
        );
      }
      return Promise.resolve({
        content: [{ type: "text", text: "anthropic-complete" }],
      });
    });
    mockOpenAICreate.mockImplementation(({ stream }: { stream?: boolean }) => {
      if (stream) {
        return (async function* () {
          yield { choices: [{ delta: { content: "open" } }] };
          yield { choices: [{ delta: { content: "ai" } }] };
        })();
      }
      return Promise.resolve({
        choices: [{ message: { content: "openai-complete" } }],
      });
    });
  });

  // ── Routing ──────────────────────────────────────────────────────────────

  it("defaults to anthropic when AI_PROVIDER is unset", () => {
    expect(getAIProvider().model).toMatch(/claude/);
  });

  it("returns anthropic for AI_PROVIDER=anthropic", () => {
    process.env.AI_PROVIDER = "anthropic";
    expect(getAIProvider().model).toMatch(/claude/);
  });

  it("returns openai for AI_PROVIDER=openai", () => {
    process.env.AI_PROVIDER = "openai";
    expect(getAIProvider().model).toMatch(/gpt/);
  });

  it("returns gemini for AI_PROVIDER=gemini", () => {
    process.env.AI_PROVIDER = "gemini";
    expect(getAIProvider().model).toMatch(/gemini/);
  });

  it("AI_MODEL overrides default", () => {
    process.env.AI_PROVIDER = "openai";
    process.env.AI_MODEL = "gpt-4-turbo";
    expect(getAIProvider().model).toBe("gpt-4-turbo");
  });

  it("returns same singleton on repeated calls", () => {
    const p1 = getAIProvider();
    const p2 = getAIProvider();
    expect(p1).toBe(p2);
  });

  it("returns new instance after reset", () => {
    const p1 = getAIProvider();
    resetAIProvider();
    process.env.AI_MODEL = "claude-haiku-4-5";
    const p2 = getAIProvider();
    expect(p1).not.toBe(p2);
    expect(p2.model).toBe("claude-haiku-4-5");
  });

  // ── HMR-safe globalThis caching (#137) ───────────────────────────────────

  it("survives module re-evaluation (dev-mode HMR) via globalThis cache", async () => {
    const p1 = getAIProvider();
    // Simulate Next.js HMR: the module is re-executed, the process persists.
    vi.resetModules();
    const fresh = await import("@/lib/ai/provider");
    const p2 = fresh.getAIProvider();
    expect(p2).toBe(p1);
  });

  it("invalidates the cache when AI_PROVIDER changes without an explicit reset", () => {
    const p1 = getAIProvider();
    expect(p1.model).toMatch(/claude/);
    process.env.AI_PROVIDER = "openai";
    const p2 = getAIProvider();
    expect(p2).not.toBe(p1);
    expect(p2.model).toMatch(/gpt/);
  });

  it("invalidates the cache when AI_MODEL changes without an explicit reset", () => {
    const p1 = getAIProvider();
    process.env.AI_MODEL = "claude-haiku-4-5";
    const p2 = getAIProvider();
    expect(p2).not.toBe(p1);
    expect(p2.model).toBe("claude-haiku-4-5");
  });

  it("invalidates the cache when OPENAI_BASE_URL changes without an explicit reset", () => {
    process.env.AI_PROVIDER = "openai";
    const p1 = getAIProvider();
    process.env.OPENAI_BASE_URL = "https://proxy.example.com/v1";
    const p2 = getAIProvider();
    expect(p2).not.toBe(p1);
  });

  // ── Anthropic adapter ────────────────────────────────────────────────────

  it("anthropic complete() calls messages.create and returns text", async () => {
    process.env.AI_PROVIDER = "anthropic";
    const result = await getAIProvider().complete({ system: "sys", prompt: "hi" });
    expect(result).toBe("anthropic-complete");
    expect(mockAnthropicCreate).toHaveBeenCalledOnce();
  });

  it("anthropic stream() yields text from content_block_delta events", async () => {
    process.env.AI_PROVIDER = "anthropic";
    const chunks: string[] = [];
    for await (const c of getAIProvider().stream({
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
    })) chunks.push(c);
    expect(chunks.join("")).toBe("anthropic");
  });

  // ── OpenAI adapter ───────────────────────────────────────────────────────

  it("openai complete() calls chat.completions.create and returns text", async () => {
    process.env.AI_PROVIDER = "openai";
    const result = await getAIProvider().complete({ system: "sys", prompt: "hi" });
    expect(result).toBe("openai-complete");
  });

  it("openai stream() yields text from delta chunks", async () => {
    process.env.AI_PROVIDER = "openai";
    const chunks: string[] = [];
    for await (const c of getAIProvider().stream({
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
    })) chunks.push(c);
    expect(chunks.join("")).toBe("openai");
  });

  // ── Transient-error retry (#143) ─────────────────────────────────────────

  describe("retry integration", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("complete() retries a 529 Overloaded error and succeeds", async () => {
      vi.useFakeTimers();
      process.env.AI_PROVIDER = "anthropic";
      mockAnthropicCreate
        .mockRejectedValueOnce(Object.assign(new Error("Overloaded"), { status: 529 }))
        .mockResolvedValueOnce({ content: [{ type: "text", text: "recovered" }] });

      const promise = getAIProvider().complete({ system: "sys", prompt: "hi" });
      await vi.runAllTimersAsync();

      expect(await promise).toBe("recovered");
      expect(mockAnthropicCreate).toHaveBeenCalledTimes(2);
    });

    it("complete() fails fast on 401 without retrying", async () => {
      process.env.AI_PROVIDER = "anthropic";
      const err = Object.assign(new Error("invalid api key"), { status: 401 });
      mockAnthropicCreate.mockRejectedValue(err);

      await expect(
        getAIProvider().complete({ system: "sys", prompt: "hi" })
      ).rejects.toBe(err);
      expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
    });

    it("stream() retries establishment failures before the first token", async () => {
      vi.useFakeTimers();
      process.env.AI_PROVIDER = "anthropic";
      mockAnthropicCreate
        .mockRejectedValueOnce(Object.assign(new Error("Overloaded"), { status: 529 }))
        .mockImplementationOnce(() =>
          Promise.resolve(
            (async function* () {
              yield { type: "content_block_delta", delta: { type: "text_delta", text: "ok" } };
            })()
          )
        );

      const collect = (async () => {
        const chunks: string[] = [];
        for await (const c of getAIProvider().stream({
          system: "sys",
          messages: [{ role: "user", content: "hi" }],
        })) chunks.push(c);
        return chunks.join("");
      })();
      await vi.runAllTimersAsync();

      expect(await collect).toBe("ok");
      expect(mockAnthropicCreate).toHaveBeenCalledTimes(2);
    });

    it("openai complete() retries a 503 and succeeds", async () => {
      vi.useFakeTimers();
      process.env.AI_PROVIDER = "openai";
      mockOpenAICreate
        .mockRejectedValueOnce(Object.assign(new Error("service unavailable"), { status: 503 }))
        .mockResolvedValueOnce({ choices: [{ message: { content: "recovered" } }] });

      const promise = getAIProvider().complete({ system: "sys", prompt: "hi" });
      await vi.runAllTimersAsync();

      expect(await promise).toBe("recovered");
      expect(mockOpenAICreate).toHaveBeenCalledTimes(2);
    });
  });
});
