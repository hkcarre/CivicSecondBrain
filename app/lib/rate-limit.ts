/**
 * In-memory sliding-window rate limiter for /api/chat.
 *
 * Every chat request triggers an AI API call, so an unauthenticated crawl
 * burst or abuse event can incur real cost. This limiter caps requests per
 * client IP per minute before any AI call is made.
 *
 * SINGLE-REPLICA ASSUMPTION: state lives in process memory, which is correct
 * for this deployment because railway.toml pins `numReplicas = 1`. If the app
 * is ever scaled to multiple replicas (or moved to a serverless/edge runtime
 * where instances multiply), each instance would keep its own counters and
 * the effective limit becomes N × CHAT_RATE_LIMIT_RPM. At that point replace
 * this with a shared store (e.g. @upstash/ratelimit backed by Redis).
 *
 * Algorithm: sliding-window log. We keep the timestamps of each client's
 * requests inside the current window and prune expired ones on every check.
 * With the default limit of 20/min this stores at most ~20 numbers per
 * active IP. The window slides continuously (no fixed-window boundary
 * bursts), and the full per-minute allowance doubles as the burst allowance:
 * a client may spend all 20 requests instantly, then must wait for
 * timestamps to age out of the window.
 */

export interface RateLimitResult {
  /** Whether this request is allowed through. */
  allowed: boolean;
  /** Configured max requests per window. */
  limit: number;
  /** Requests remaining in the current window (0 when blocked). */
  remaining: number;
  /** Seconds until the client should retry (0 when allowed). */
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  /** Max requests per window per key. Default 20. */
  limit?: number;
  /** Window size in milliseconds. Default 60_000 (1 minute). */
  windowMs?: number;
  /** Clock injection for tests. Default Date.now. */
  now?: () => number;
}

export interface RateLimiter {
  /** Record a request for `key` and report whether it is allowed. */
  check(key: string): RateLimitResult;
  /** Number of keys currently tracked (exposed for tests/monitoring). */
  size(): number;
  /** Drop all state (exposed for tests). */
  reset(): void;
}

const DEFAULT_LIMIT = 20;
const DEFAULT_WINDOW_MS = 60_000;

/**
 * Create an isolated sliding-window limiter. Pure factory — no globals — so
 * tests can create instances with a fake clock and small limits.
 */
export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const now = options.now ?? Date.now;

  /** key → sorted (append-order) timestamps of requests inside the window */
  const hits = new Map<string, number[]>();
  let lastSweepAt = now();

  /**
   * Periodic cleanup: once per window, walk the whole map and drop entries
   * whose timestamps have all expired. check() already prunes the key being
   * checked, so this sweep exists only to reclaim memory for IPs that
   * stopped sending requests — without it the Map grows unbounded across a
   * long-running process.
   */
  function sweep(ts: number): void {
    if (ts - lastSweepAt < windowMs) return;
    lastSweepAt = ts;
    const cutoff = ts - windowMs;
    for (const [key, timestamps] of hits) {
      const fresh = timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) {
        hits.delete(key);
      } else if (fresh.length !== timestamps.length) {
        hits.set(key, fresh);
      }
    }
  }

  function check(key: string): RateLimitResult {
    const ts = now();
    sweep(ts);

    const cutoff = ts - windowMs;
    const timestamps = (hits.get(key) ?? []).filter((t) => t > cutoff);

    if (timestamps.length >= limit) {
      // Oldest in-window request determines when a slot frees up.
      const retryAfterMs = timestamps[0] + windowMs - ts;
      hits.set(key, timestamps); // keep pruned list (do NOT count blocked hits)
      return {
        allowed: false,
        limit,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    }

    timestamps.push(ts);
    hits.set(key, timestamps);
    return {
      allowed: true,
      limit,
      remaining: limit - timestamps.length,
      retryAfterSeconds: 0,
    };
  }

  return {
    check,
    size: () => hits.size,
    reset: () => {
      hits.clear();
      lastSweepAt = now();
    },
  };
}

/**
 * Resolve the client IP. Railway sits behind a proxy, so the real client is
 * the FIRST hop of x-forwarded-for; fall back to x-real-ip, then a constant
 * (which effectively rate-limits all unidentifiable clients as one bucket).
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

// ─── Shared /api/chat limiter singleton ─────────────────────────────────────

function chatLimitFromEnv(): number {
  const raw = Number(process.env.CHAT_RATE_LIMIT_RPM);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_LIMIT;
}

let chatLimiter: RateLimiter | null = null;

/**
 * Check the shared /api/chat limiter for one client IP. The limiter is
 * created lazily so CHAT_RATE_LIMIT_RPM is read at first use (which also
 * lets tests set the env var before a fresh dynamic import).
 */
export function checkChatRateLimit(ip: string): RateLimitResult {
  if (!chatLimiter) {
    chatLimiter = createRateLimiter({ limit: chatLimitFromEnv() });
  }
  return chatLimiter.check(ip);
}
