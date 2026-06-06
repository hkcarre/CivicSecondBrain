/**
 * app/lib/ai/provider.ts
 *
 * Provider-agnostic AI client factory.
 *
 * Supports:
 *   AI_PROVIDER=anthropic  (default) — Anthropic Claude via @anthropic-ai/sdk
 *   AI_PROVIDER=openai     — OpenAI GPT models via openai npm SDK
 *   AI_PROVIDER=gemini     — Google Gemini via OpenAI-compatible endpoint
 *
 * All providers expose the same two interfaces:
 *   complete(opts)  — single-turn, returns full text (for ingest + lint)
 *   stream(opts)    — streaming, returns AsyncIterable<string> (for chat)
 *
 * Environment variables:
 *   AI_PROVIDER       — "anthropic" | "openai" | "gemini"  (default: "anthropic")
 *   AI_MODEL          — model name override (optional)
 *   ANTHROPIC_API_KEY — required for anthropic provider
 *   OPENAI_API_KEY    — required for openai provider
 *   OPENAI_BASE_URL   — optional base URL override (for proxies, Gemini, etc.)
 *   GEMINI_API_KEY    — convenience alias for OPENAI_API_KEY when AI_PROVIDER=gemini
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export interface AICompleteOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface AIStreamOptions {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}

export interface AIProvider {
  /** Single-turn completion. Returns the full response text. */
  complete(opts: AICompleteOptions): Promise<string>;
  /** Streaming completion. Yields text delta chunks. */
  stream(opts: AIStreamOptions): AsyncIterable<string>;
  /** The resolved model name being used. */
  model: string;
}

// ─── Provider: Anthropic ─────────────────────────────────────────────────

function buildAnthropicProvider(): AIProvider {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.AI_MODEL ?? "claude-sonnet-4-5";

  return {
    model,

    async complete({ system, prompt, maxTokens = 4096 }: AICompleteOptions): Promise<string> {
      const msg = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      });
      const block = msg.content[0];
      return block.type === "text" ? block.text : "";
    },

    async *stream({ system, messages, maxTokens = 2048 }: AIStreamOptions): AsyncIterable<string> {
      const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        system,
        messages,
      });
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield event.delta.text;
        }
      }
    },
  };
}

// ─── Provider: OpenAI / Gemini (OpenAI-compatible) ───────────────────────

function buildOpenAIProvider(isGemini = false): AIProvider {
  const apiKey = isGemini
    ? (process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY ?? "")
    : (process.env.OPENAI_API_KEY ?? "");

  const baseURL = process.env.OPENAI_BASE_URL ?? (isGemini
    ? "https://generativelanguage.googleapis.com/v1beta/openai/"
    : undefined);

  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

  const defaultModel = isGemini ? "gemini-2.0-flash" : "gpt-4o";
  const model = process.env.AI_MODEL ?? defaultModel;

  return {
    model,

    async complete({ system, prompt, maxTokens = 4096 }: AICompleteOptions): Promise<string> {
      const res = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      });
      return res.choices[0]?.message?.content ?? "";
    },

    async *stream({ system, messages, maxTokens = 2048 }: AIStreamOptions): AsyncIterable<string> {
      const stream = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        stream: true,
        messages: [
          { role: "system", content: system },
          ...messages,
        ],
      });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    },
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────

let _provider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (_provider) return _provider;

  const providerName = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();

  switch (providerName) {
    case "openai":
      _provider = buildOpenAIProvider(false);
      break;
    case "gemini":
      _provider = buildOpenAIProvider(true);
      break;
    case "anthropic":
    default:
      _provider = buildAnthropicProvider();
      break;
  }

  console.log(`[ai] Provider: ${providerName}, model: ${_provider.model}`);
  return _provider;
}

/** Reset the singleton (useful in tests to switch providers between cases). */
export function resetAIProvider(): void {
  _provider = null;
}
