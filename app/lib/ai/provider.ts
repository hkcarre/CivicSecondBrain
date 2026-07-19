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
import { withRetry } from "./retry";

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

/** Logs each transient-error retry so backoff activity is visible in server logs. */
function logRetry(label: string) {
  return (err: unknown, attempt: number, delayMs: number): void => {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(`[ai] ${label}: transient error (retry ${attempt}, waiting ${delayMs}ms): ${detail}`);
  };
}

// ─── Provider: Anthropic ─────────────────────────────────────────────────

function buildAnthropicProvider(): AIProvider {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.AI_MODEL ?? "claude-sonnet-4-5";

  return {
    model,

    async complete({ system, prompt, maxTokens = 4096 }: AICompleteOptions): Promise<string> {
      const msg = await withRetry(
        () =>
          client.messages.create({
            model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: "user", content: prompt }],
          }),
        { onRetry: logRetry("anthropic complete") }
      );
      const block = msg.content[0];
      return block.type === "text" ? block.text : "";
    },

    async *stream({ system, messages, maxTokens = 2048 }: AIStreamOptions): AsyncIterable<string> {
      // Retry covers stream ESTABLISHMENT only (429/529/network errors reject
      // the create() promise before any token arrives). Mid-stream failures
      // are not retried — the partial response has already been forwarded.
      const stream = await withRetry(
        () =>
          client.messages.create({
            model,
            max_tokens: maxTokens,
            system,
            messages,
            stream: true,
          }),
        { onRetry: logRetry("anthropic stream") }
      );
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
      const res = await withRetry(
        () =>
          client.chat.completions.create({
            model,
            max_tokens: maxTokens,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
        { onRetry: logRetry(`${isGemini ? "gemini" : "openai"} complete`) }
      );
      return res.choices[0]?.message?.content ?? "";
    },

    async *stream({ system, messages, maxTokens = 2048 }: AIStreamOptions): AsyncIterable<string> {
      // Retry covers stream ESTABLISHMENT only — see the anthropic adapter.
      const stream = await withRetry(
        () =>
          client.chat.completions.create({
            model,
            max_tokens: maxTokens,
            stream: true,
            messages: [
              { role: "system", content: system },
              ...messages,
            ],
          }),
        { onRetry: logRetry(`${isGemini ? "gemini" : "openai"} stream`) }
      );
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    },
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────
//
// The cached instance lives on `globalThis` (the standard Next.js pattern for
// dev-mode singletons): HMR re-executes this module while the process — and
// globalThis — persists, so a module-level `let` would be reset on every hot
// reload while a plain module-level cache from a PREVIOUS evaluation would go
// stale. The cache is additionally keyed by the config that defines the
// provider (provider name + model + base URL), so editing .env.local (e.g.
// switching AI_PROVIDER) invalidates the cached instance instead of returning
// a stale one.

interface AIProviderCacheEntry {
  key: string;
  provider: AIProvider;
}

const globalForAIProvider = globalThis as typeof globalThis & {
  __civicAIProviderCache?: AIProviderCacheEntry;
};

/** Cache key derived from every env var that determines which provider/client is built. */
function providerConfigKey(providerName: string): string {
  return [
    providerName,
    process.env.AI_MODEL ?? "",
    process.env.OPENAI_BASE_URL ?? "",
  ].join("|");
}

export function getAIProvider(): AIProvider {
  const providerName = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();
  const key = providerConfigKey(providerName);

  const cached = globalForAIProvider.__civicAIProviderCache;
  if (cached && cached.key === key) return cached.provider;

  let provider: AIProvider;
  switch (providerName) {
    case "openai":
      provider = buildOpenAIProvider(false);
      break;
    case "gemini":
      provider = buildOpenAIProvider(true);
      break;
    case "anthropic":
    default:
      provider = buildAnthropicProvider();
      break;
  }

  globalForAIProvider.__civicAIProviderCache = { key, provider };
  console.log(`[ai] Provider: ${providerName}, model: ${provider.model}`);
  return provider;
}

/** Reset the cached provider (useful in tests to switch providers between cases). */
export function resetAIProvider(): void {
  globalForAIProvider.__civicAIProviderCache = undefined;
}
