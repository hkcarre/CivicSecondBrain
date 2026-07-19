/**
 * app/lib/ai/retry.ts
 *
 * Generic retry helper with exponential backoff + jitter for transient
 * AI-provider failures (Anthropic 529 Overloaded, OpenAI 503, rate-limit
 * 429, network-level errors).
 *
 * Deliberately SDK-agnostic: transient detection works off the common
 * error shapes of @anthropic-ai/sdk, openai, and Node's fetch/undici
 * (`status`/`statusCode` numbers, `code` strings, `cause` chains) so it
 * never needs to import either SDK.
 */

export interface RetryOptions {
  /** Number of retry attempts after the initial call (default 3). */
  retries?: number;
  /** Base delay for exponential backoff in ms (default 500). */
  baseDelayMs?: number;
  /** Upper bound on any single backoff delay in ms (default 8000). */
  maxDelayMs?: number;
  /** Predicate deciding whether an error is worth retrying (default {@link isTransientError}). */
  isRetryable?: (err: unknown) => boolean;
  /** Called before each backoff sleep — useful for logging. */
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

/** Network-level error codes (Node / undici) that indicate a transient failure. */
const TRANSIENT_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

/** SDK error-class names that represent connection-level (pre-response) failures. */
const CONNECTION_ERROR_NAMES = new Set([
  "APIConnectionError", // both @anthropic-ai/sdk and openai
  "APIConnectionTimeoutError",
  "FetchError",
  "AbortError",
]);

function httpStatusOf(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as { status?: unknown; statusCode?: unknown };
  if (typeof e.status === "number") return e.status;
  if (typeof e.statusCode === "number") return e.statusCode;
  return undefined;
}

/**
 * True for errors that are worth retrying:
 *   - HTTP 429 (rate limit) and any 5xx (500/502/503, Anthropic 529 Overloaded)
 *   - network-level errors (ECONNRESET, ETIMEDOUT, fetch failed, SDK
 *     APIConnectionError, etc.)
 *
 * False for everything else — notably 400/401/403, which indicate a
 * request/auth problem that will never succeed on retry.
 */
export function isTransientError(err: unknown): boolean {
  const status = httpStatusOf(err);
  if (status !== undefined) {
    // A definitive HTTP status: only rate limits and server errors are transient.
    return status === 429 || status >= 500;
  }

  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; name?: unknown; message?: unknown; cause?: unknown };

  if (typeof e.code === "string" && TRANSIENT_ERROR_CODES.has(e.code)) return true;
  if (typeof e.name === "string" && CONNECTION_ERROR_NAMES.has(e.name)) return true;

  // Node's global fetch wraps network failures in `TypeError: fetch failed`
  // with the real error on `cause` — recurse into it.
  if (e.cause !== undefined && e.cause !== err && isTransientError(e.cause)) return true;

  if (
    typeof e.message === "string" &&
    /fetch failed|network error|socket hang up|Connection error/i.test(e.message)
  ) {
    return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn`, retrying transient failures with exponential backoff + jitter.
 *
 * Delay for retry N (0-indexed) is `min(maxDelayMs, baseDelayMs * 2^N)`
 * scaled by an equal-jitter factor in [0.5, 1.0].
 *
 * Non-transient errors (per `isRetryable`) are rethrown immediately; once
 * retries are exhausted the last error is thrown.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const {
    retries = 3,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    isRetryable = isTransientError,
    onRetry,
  } = opts;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= retries || !isRetryable(err)) throw err;

      const expDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const delayMs = Math.round(expDelay * (0.5 + Math.random() * 0.5));
      onRetry?.(err, attempt + 1, delayMs);
      await sleep(delayMs);
    }
  }

  // Unreachable — the loop either returns or throws — but satisfies TS.
  throw lastError;
}
