import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRateLimiter, getClientIp } from "../lib/rate-limit";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-18T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.CHAT_RATE_LIMIT_RPM;
});

describe("createRateLimiter — allow/block", () => {
  it("allows requests under the limit", () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });
    for (let i = 0; i < 5; i++) {
      const result = limiter.check("1.2.3.4");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5 - (i + 1));
      expect(result.retryAfterSeconds).toBe(0);
    }
  });

  it("blocks requests over the limit with a retry-after", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i++) {
      expect(limiter.check("1.2.3.4").allowed).toBe(true);
    }
    const blocked = limiter.check("1.2.3.4");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("does not count blocked requests against the window", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    limiter.check("1.2.3.4");
    limiter.check("1.2.3.4");
    // Hammer while blocked — should not extend the block
    for (let i = 0; i < 10; i++) {
      expect(limiter.check("1.2.3.4").allowed).toBe(false);
    }
    vi.advanceTimersByTime(60_001);
    expect(limiter.check("1.2.3.4").allowed).toBe(true);
  });
});

describe("createRateLimiter — window expiry", () => {
  it("restores the allowance after the window slides past old requests", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(limiter.check("1.2.3.4").allowed).toBe(true);
    expect(limiter.check("1.2.3.4").allowed).toBe(true);
    expect(limiter.check("1.2.3.4").allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    const afterExpiry = limiter.check("1.2.3.4");
    expect(afterExpiry.allowed).toBe(true);
    expect(afterExpiry.remaining).toBe(1);
  });

  it("slides continuously — frees exactly the slots that aged out", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    limiter.check("1.2.3.4"); // t = 0s
    vi.advanceTimersByTime(30_000);
    limiter.check("1.2.3.4"); // t = 30s
    expect(limiter.check("1.2.3.4").allowed).toBe(false); // both in window

    vi.advanceTimersByTime(31_000); // t = 61s — first request expired
    expect(limiter.check("1.2.3.4").allowed).toBe(true); // one slot free
    expect(limiter.check("1.2.3.4").allowed).toBe(false); // t=30s hit still live
  });

  it("reports retryAfterSeconds based on the oldest in-window request", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.check("1.2.3.4");
    vi.advanceTimersByTime(45_000);
    const blocked = limiter.check("1.2.3.4");
    expect(blocked.allowed).toBe(false);
    // Oldest hit expires 15s from now
    expect(blocked.retryAfterSeconds).toBe(15);
  });
});

describe("createRateLimiter — per-IP isolation", () => {
  it("tracks each key independently", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(limiter.check("1.1.1.1").allowed).toBe(true);
    expect(limiter.check("1.1.1.1").allowed).toBe(true);
    expect(limiter.check("1.1.1.1").allowed).toBe(false);

    // A different IP is unaffected by the first IP's exhaustion
    expect(limiter.check("2.2.2.2").allowed).toBe(true);
    expect(limiter.check("2.2.2.2").allowed).toBe(true);
    expect(limiter.check("2.2.2.2").allowed).toBe(false);
  });
});

describe("createRateLimiter — stale-entry cleanup", () => {
  it("sweeps expired keys out of the map so it does not grow unbounded", () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });
    for (let i = 0; i < 50; i++) {
      limiter.check(`10.0.0.${i}`);
    }
    expect(limiter.size()).toBe(50);

    // All 50 entries age out; the next check triggers the periodic sweep
    vi.advanceTimersByTime(120_000);
    limiter.check("fresh-ip");
    expect(limiter.size()).toBe(1); // only "fresh-ip" remains
  });

  it("keeps keys that still have in-window activity during a sweep", () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });
    limiter.check("stale-ip"); // t = 0
    vi.advanceTimersByTime(59_000);
    limiter.check("active-ip"); // t = 59s
    vi.advanceTimersByTime(2_000); // t = 61s — stale-ip expired, active-ip live
    limiter.check("fresh-ip"); // triggers sweep
    expect(limiter.size()).toBe(2); // active-ip + fresh-ip
  });

  it("reset() clears all state", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.check("1.2.3.4");
    expect(limiter.check("1.2.3.4").allowed).toBe(false);
    limiter.reset();
    expect(limiter.size()).toBe(0);
    expect(limiter.check("1.2.3.4").allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("uses the first hop of x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2",
      "x-real-ip": "10.0.0.1",
    });
    expect(getClientIp(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.9" });
    expect(getClientIp(headers)).toBe("198.51.100.9");
  });

  it("falls back to 'unknown' when no headers are present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });

  it("ignores an empty x-forwarded-for value", () => {
    const headers = new Headers({ "x-forwarded-for": "  " });
    expect(getClientIp(headers)).toBe("unknown");
  });
});

describe("checkChatRateLimit — env-configured singleton", () => {
  it("reads CHAT_RATE_LIMIT_RPM on first use", async () => {
    vi.resetModules();
    process.env.CHAT_RATE_LIMIT_RPM = "2";
    const { checkChatRateLimit } = await import("../lib/rate-limit");
    expect(checkChatRateLimit("9.9.9.9").allowed).toBe(true);
    expect(checkChatRateLimit("9.9.9.9").allowed).toBe(true);
    const blocked = checkChatRateLimit("9.9.9.9");
    expect(blocked.allowed).toBe(false);
    expect(blocked.limit).toBe(2);
  });

  it("defaults to 20 rpm when the env var is unset or invalid", async () => {
    vi.resetModules();
    process.env.CHAT_RATE_LIMIT_RPM = "not-a-number";
    const { checkChatRateLimit } = await import("../lib/rate-limit");
    expect(checkChatRateLimit("8.8.8.8").limit).toBe(20);
  });
});
