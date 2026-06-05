/**
 * Tests for app/api/health/route.ts
 *
 * Covers:
 * - Fast-fail when ANTHROPIC_API_KEY is unset
 * - Degraded when the live probe returns an HTTP error (e.g. 401 revoked key)
 * - Degraded when the live probe times-out / network error
 * - Healthy when the probe succeeds
 * - 60-second cache: second call within TTL skips the network
 * - Cache expires: call after TTL re-probes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let tmpDir: string;

/** Re-import the route module with a clean module registry each time so that
 *  module-level cache variables are reset between tests. */
async function importRoute() {
  vi.resetModules();
  return import("../api/health/route");
}

/** Call the route's GET handler and parse the JSON body. */
async function callGET(route: { GET: () => Promise<Response> }) {
  const res = await route.GET();
  const body = await res.json();
  return { status: res.status, body };
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "health-test-"));
  // Create the minimal wiki structure the route inspects
  fs.mkdirSync(path.join(tmpDir, "topics"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, "index.md"), "# Index\n");
  process.env.WIKI_PATH = tmpDir;
  process.env.RAW_SOURCES_PATH = path.join(tmpDir, "raw-sources");
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-valid-key";
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.WIKI_PATH;
  delete process.env.RAW_SOURCES_PATH;
  delete process.env.ANTHROPIC_API_KEY;
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/health — env-var fast-fail", () => {
  it("returns 503 degraded when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    // fetch should NOT be called — mock it to throw so we know
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("should not be called")));

    const route = await importRoute();
    const { status, body } = await callGET(route);

    expect(status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.errors).toContain("ANTHROPIC_API_KEY is not set");
    // probe must NOT have been attempted
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

describe("GET /api/health — live probe scenarios", () => {
  it("returns 200 ok when the Anthropic probe succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [] }), { status: 200 }))
    );

    const route = await importRoute();
    const { status, body } = await callGET(route);

    expect(status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.errors).toHaveLength(0);
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it("returns 503 degraded when the probe returns HTTP 401 (revoked key)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }))
    );

    const route = await importRoute();
    const { status, body } = await callGET(route);

    expect(status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.errors.some((e: string) => e.includes("401"))).toBe(true);
  });

  it("returns 503 degraded when the probe throws a network / timeout error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }))
    );

    const route = await importRoute();
    const { status, body } = await callGET(route);

    expect(status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(
      body.errors.some((e: string) => e.toLowerCase().includes("anthropic api key invalid or unreachable"))
    ).toBe(true);
  });
});

describe("GET /api/health — 60-second probe cache", () => {
  it("does not re-probe within the 60-second TTL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    );

    const route = await importRoute();

    // First call — probe runs
    await callGET(route);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    // Second call within TTL — should reuse cache, no extra fetch
    await callGET(route);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("re-probes after the 60-second TTL expires", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    // Fake Date.now() to control time
    const realNow = Date.now;
    let fakeNow = realNow();
    vi.spyOn(Date, "now").mockImplementation(() => fakeNow);

    const route = await importRoute();

    // First call at t=0
    await callGET(route);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance time past TTL (61 s)
    fakeNow += 61_000;

    // Second call at t=61s — cache stale, should re-probe
    await callGET(route);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.spyOn(Date, "now").mockRestore();
  });
});

describe("GET /api/health — wiki state reflected in response", () => {
  it("includes wiki.indexExists=true when index.md is present", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));

    const route = await importRoute();
    const { body } = await callGET(route);

    expect(body.wiki.indexExists).toBe(true);
  });

  it("sets degraded when index.md is missing", async () => {
    fs.unlinkSync(path.join(tmpDir, "index.md"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));

    const route = await importRoute();
    const { status, body } = await callGET(route);

    expect(status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.errors.some((e: string) => e.includes("wiki/index.md"))).toBe(true);
  });

  it("reports correct topicCount for .md files in topics/", async () => {
    fs.writeFileSync(path.join(tmpDir, "topics", "budget.md"), "# Budget\n");
    fs.writeFileSync(path.join(tmpDir, "topics", "infrastructure.md"), "# Infra\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));

    const route = await importRoute();
    const { body } = await callGET(route);

    expect(body.wiki.topicCount).toBe(2);
  });
});
