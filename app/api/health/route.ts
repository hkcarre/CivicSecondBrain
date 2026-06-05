import fs from "fs";

export const runtime = "nodejs";

// ─── Live probe cache ─────────────────────────────────────────────────────────
// Avoids hammering the Anthropic API on every health-check tick.
// Cache entry is invalidated after PROBE_TTL_MS milliseconds.
const PROBE_TTL_MS = 60_000;

let probeOk: boolean | null = null;
let probeError: string | null = null;
let probeAt = 0;

/**
 * Validates the Anthropic API key by calling the lightweight models list
 * endpoint (GET /v1/models).  Result is cached for 60 s so the health route
 * stays responsive under traffic.
 */
async function runProbe(): Promise<{ ok: boolean; error: string | null }> {
  const now = Date.now();
  if (probeOk !== null && now - probeAt < PROBE_TTL_MS) {
    // Cached result is still fresh — return it without a network call
    return { ok: probeOk, error: probeError };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(3_000),
    });

    if (res.ok) {
      probeOk = true;
      probeError = null;
    } else {
      probeOk = false;
      probeError = `HTTP ${res.status} ${res.statusText}`;
    }
  } catch (err: unknown) {
    probeOk = false;
    probeError =
      err instanceof Error ? err.message : "Anthropic probe failed";
  }

  probeAt = Date.now();
  return { ok: probeOk, error: probeError };
}

export async function GET() {
  const wikiPath = process.env.WIKI_PATH ?? "./wiki";
  const rawPath = process.env.RAW_SOURCES_PATH ?? "./raw-sources";

  const checks = {
    status: "ok" as "ok" | "degraded",
    ts: Date.now(),
    env: {
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      WIKI_PATH: wikiPath,
      RAW_SOURCES_PATH: rawPath,
    },
    wiki: {
      indexExists: fs.existsSync(`${wikiPath}/index.md`),
      topicsDir: fs.existsSync(`${wikiPath}/topics`),
      topicCount: 0,
    },
    errors: [] as string[],
  };

  // Count topic pages
  try {
    const topics = fs.readdirSync(`${wikiPath}/topics`).filter(f => f.endsWith(".md"));
    checks.wiki.topicCount = topics.length;
  } catch {
    checks.errors.push("Cannot read wiki/topics/");
  }

  // Fast-fail: env-var missing → skip the network probe entirely
  if (!process.env.ANTHROPIC_API_KEY) {
    checks.errors.push("ANTHROPIC_API_KEY is not set");
    checks.status = "degraded";
  } else {
    // Live probe: validate the key is still accepted by the Anthropic API.
    // Uses GET /v1/models — lightest read-only call, cached 60 s.
    const probe = await runProbe();
    if (!probe.ok) {
      checks.errors.push(
        `Anthropic API key invalid or unreachable: ${probe.error ?? "unknown error"}`
      );
      checks.status = "degraded";
    }
  }

  if (!checks.wiki.indexExists) {
    checks.errors.push("wiki/index.md not found — run ingest:seed");
    checks.status = "degraded";
  }

  return Response.json(checks, {
    status: checks.status === "ok" ? 200 : 503,
  });
}
