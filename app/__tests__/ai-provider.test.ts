/**
 * ai-provider.test.ts
 *
 * Tests the provider factory routing, singleton, reset, and model resolution.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAIProvider, resetAIProvider } from "@/lib/ai/provider";

// ─── Shared mock instances ────────────────────────────────────────────────

const mockAnthropicCreate = vi.fn();
const mockAnthropicStream = vi.fn();
const mockOpenAICreate = vi.fn();

// ─── Mock SDKs before provider is imported ────────────────────────────────

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: mockAnthropicCreate,
      stream: mockAnthropicStream,
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
    resetAIProvider();
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_BASE_URL;

    // Default mock return values
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "anthropic-complete" }],
    });
    mockAnthropicStream.mockReturnValue(
      (async function* () {
        yield { type: "content_block_delta", delta: { type: "text_delta", text: "ant" } };
        yield { type: "content_block_delta", delta: { type: "text_delta", text: "hropic" } };
      })()
    );
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
});
