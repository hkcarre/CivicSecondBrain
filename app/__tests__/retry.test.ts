/**
 * retry.test.ts
 *
 * Tests the withRetry helper: transient-error detection, retry-then-succeed,
 * retry exhaustion, fail-fast on non-transient errors, and backoff timing.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { withRetry, isTransientError } from "@/lib/ai/retry";

function httpError(status: number, message = `HTTP ${status}`): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── isTransientError ─────────────────────────────────────────────────────

describe("isTransientError", () => {
  it("treats 429 and 5xx statuses as transient", () => {
    expect(isTransientError(httpError(429))).toBe(true);
    expect(isTransientError(httpError(500))).toBe(true);
    expect(isTransientError(httpError(502))).toBe(true);
    expect(isTransientError(httpError(503))).toBe(true);
    expect(isTransientError(httpError(529, "Overloaded"))).toBe(true);
  });

  it("treats client errors as permanent", () => {
    expect(isTransientError(httpError(400))).toBe(false);
    expect(isTransientError(httpError(401))).toBe(false);
    expect(isTransientError(httpError(403))).toBe(false);
    expect(isTransientError(httpError(404))).toBe(false);
  });

  it("supports statusCode as an alias for status", () => {
    expect(isTransientError(Object.assign(new Error("nope"), { statusCode: 503 }))).toBe(true);
    expect(isTransientError(Object.assign(new Error("nope"), { statusCode: 401 }))).toBe(false);
  });

  it("treats network-level errors as transient", () => {
    expect(isTransientError(Object.assign(new Error("reset"), { code: "ECONNRESET" }))).toBe(true);
    expect(isTransientError(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }))).toBe(true);

    // SDK connection-error classes (Anthropic + OpenAI both use this name)
    const connErr = new Error("Connection error.");
    connErr.name = "APIConnectionError";
    expect(isTransientError(connErr)).toBe(true);

    // Node fetch wraps the real error in `TypeError: fetch failed` via cause
    const fetchErr = new TypeError("fetch failed");
    (fetchErr as TypeError & { cause: unknown }).cause = Object.assign(new Error("refused"), {
      code: "ECONNREFUSED",
    });
    expect(isTransientError(fetchErr)).toBe(true);
  });

  it("treats generic errors and non-errors as permanent", () => {
    expect(isTransientError(new Error("something broke"))).toBe(false);
    expect(isTransientError("string error")).toBe(false);
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
  });
});

// ─── withRetry ────────────────────────────────────────────────────────────

describe("withRetry", () => {
  it("returns the result without retrying on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries transient errors and then succeeds", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(httpError(529, "Overloaded"))
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce("recovered");

    const promise = withRetry(fn);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("exhausts retries and throws the last error", async () => {
    vi.useFakeTimers();
    const first = httpError(503, "first failure");
    const last = httpError(529, "last failure");
    const fn = vi
      .fn()
      .mockRejectedValueOnce(first)
      .mockRejectedValueOnce(httpError(503, "middle failure"))
      .mockRejectedValue(last);

    const promise = withRetry(fn, { retries: 2 });
    promise.catch(() => {}); // observe early so no unhandled-rejection noise

    await vi.runAllTimersAsync();

    await expect(promise).rejects.toBe(last);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("does NOT retry on 401 (fails fast)", async () => {
    const err = httpError(401, "invalid api key");
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 400 or 403 (fails fast)", async () => {
    for (const status of [400, 403]) {
      const err = httpError(status);
      const fn = vi.fn().mockRejectedValue(err);
      await expect(withRetry(fn)).rejects.toBe(err);
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it("retries network errors", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("reset"), { code: "ECONNRESET" }))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(fn);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("backs off exponentially (500ms, 1s, 2s with base 500)", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(1); // jitter factor pinned to 1.0
    const err = httpError(529, "Overloaded");
    const fn = vi.fn().mockRejectedValue(err);

    const promise = withRetry(fn, { retries: 3, baseDelayMs: 500, maxDelayMs: 8000 });
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1); // initial attempt, now sleeping 500ms

    await vi.advanceTimersByTimeAsync(499);
    expect(fn).toHaveBeenCalledTimes(1); // not yet
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2); // retry 1 after exactly 500ms

    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(3); // retry 2 after 1000ms

    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(4); // retry 3 after 2000ms

    await expect(promise).rejects.toBe(err);
  });

  it("caps the backoff delay at maxDelayMs", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(1);
    const err = httpError(503);
    const fn = vi.fn().mockRejectedValue(err);

    const promise = withRetry(fn, { retries: 3, baseDelayMs: 500, maxDelayMs: 1000 });
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500); // 500ms
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000); // capped at 1000ms (not 1000*2)
    expect(fn).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(1000); // still capped
    expect(fn).toHaveBeenCalledTimes(4);

    await expect(promise).rejects.toBe(err);
  });

  it("applies jitter within [0.5, 1.0] of the exponential delay", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // jitter factor pinned to 0.5
    const fn = vi
      .fn()
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(fn, { baseDelayMs: 500 });

    await vi.advanceTimersByTimeAsync(249);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // 500 * 0.5 = 250ms
    expect(fn).toHaveBeenCalledTimes(2);

    await expect(promise).resolves.toBe("ok");
  });

  it("invokes onRetry with the error, attempt number, and delay", async () => {
    vi.useFakeTimers();
    const err = httpError(529, "Overloaded");
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce("ok");

    const promise = withRetry(fn, { onRetry });
    await vi.runAllTimersAsync();
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(err, 1, expect.any(Number));
  });

  it("respects a custom isRetryable predicate", async () => {
    vi.useFakeTimers();
    const err = new Error("custom-retryable");
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce("ok");

    const promise = withRetry(fn, { isRetryable: (e) => e === err });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
