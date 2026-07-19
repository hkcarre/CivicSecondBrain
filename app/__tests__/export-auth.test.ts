/**
 * export-auth.test.ts
 *
 * Auth tests for the /api/export/* routes.
 *
 * GET /api/export/wiki accepts EITHER a valid admin_session cookie OR an
 * Authorization: Bearer INGEST_SECRET header. With neither ADMIN_PASSWORD
 * nor INGEST_SECRET configured, it stays open (dev mode).
 *
 * GET /api/export/recommendations and GET /api/export/chat-log are
 * intentionally public — recommendations feed the public dashboard, and
 * the chat log is the public-records (TPIA) export.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

const ADMIN_PASSWORD = "correct-horse-battery-staple";
const INGEST_SECRET = "test-ingest-secret";

// Same derivation as middleware.ts / /api/admin/login:
// HMAC-SHA256(key = ADMIN_PASSWORD, message = "civic-admin"), hex-encoded.
function adminSessionToken(password: string): string {
  return createHmac("sha256", password).update("civic-admin").digest("hex");
}

let tmpDir: string;

// Re-import after resetting env so module-level consts pick up changes
async function importWikiRoute() {
  vi.resetModules();
  return import("@/api/export/wiki/route");
}

async function importRecsRoute() {
  vi.resetModules();
  return import("@/api/export/recommendations/route");
}

async function importChatLogRoute() {
  vi.resetModules();
  return import("@/api/export/chat-log/route");
}

function makeGet(
  url: string,
  headers: Record<string, string> = {}
): Request {
  return new Request(url, { method: "GET", headers });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-auth-test-"));
  process.env.WIKI_PATH = tmpDir;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.INGEST_SECRET;

  // Seed one wiki page + one recommendation so authorized requests return 200
  const topicsDir = path.join(tmpDir, "topics");
  fs.mkdirSync(topicsDir, { recursive: true });
  fs.writeFileSync(
    path.join(topicsDir, "budget.md"),
    `---\ntitle: Budget\ncategory: topic\n---\n\nBudget content.`,
    "utf-8"
  );
  const recDir = path.join(tmpDir, "recommendations");
  fs.mkdirSync(recDir, { recursive: true });
  fs.writeFileSync(
    path.join(recDir, "2026-01-01-test.md"),
    `---\ntitle: Test Rec\nseverity: high\n---\n\n**Finding:** Something.\n`,
    "utf-8"
  );

  // Seed one chat-log month so authorized chat-log requests return 200
  const chatLogDir = path.join(tmpDir, "chat-log");
  fs.mkdirSync(chatLogDir, { recursive: true });
  process.env.CHAT_LOG_PATH = chatLogDir;
  fs.writeFileSync(
    path.join(chatLogDir, "2026-01.jsonl"),
    JSON.stringify({
      timestamp: "2026-01-15T12:00:00.000Z",
      question: "What is the budget?",
      answer: "The budget is $4.2M (FY2024).",
      pagesUsed: ["topics/budget.md"],
      model: "test",
      latencyMs: 100,
    }) + "\n",
    "utf-8"
  );
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.WIKI_PATH;
  delete process.env.CHAT_LOG_PATH;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.INGEST_SECRET;
});

describe("export route auth — dev mode", () => {
  it("allows /api/export/wiki when neither ADMIN_PASSWORD nor INGEST_SECRET is set", async () => {
    const { GET } = await importWikiRoute();
    const res = await GET(makeGet("http://localhost/api/export/wiki") as any);
    expect(res.status).toBe(200);
  });

  it("allows /api/export/recommendations when neither secret is set", async () => {
    const { GET } = await importRecsRoute();
    const res = await GET(
      makeGet("http://localhost/api/export/recommendations") as any
    );
    expect(res.status).toBe(200);
  });

  it("allows /api/export/chat-log when neither secret is set", async () => {
    const { GET } = await importChatLogRoute();
    const res = await GET(
      makeGet("http://localhost/api/export/chat-log?month=2026-01") as any
    );
    expect(res.status).toBe(200);
  });
});

describe("export route auth — admin session cookie", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  });

  it("returns 401 without a cookie", async () => {
    const { GET } = await importWikiRoute();
    const res = await GET(makeGet("http://localhost/api/export/wiki") as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("returns 401 with an invalid cookie", async () => {
    const { GET } = await importWikiRoute();
    const res = await GET(
      makeGet("http://localhost/api/export/wiki", {
        cookie: "admin_session=not-the-real-token",
      }) as any
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with a valid admin_session cookie", async () => {
    const { GET } = await importWikiRoute();
    const res = await GET(
      makeGet("http://localhost/api/export/wiki", {
        cookie: `admin_session=${adminSessionToken(ADMIN_PASSWORD)}`,
      }) as any
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
  });

  it("accepts the cookie among other cookies", async () => {
    const { GET } = await importWikiRoute();
    const res = await GET(
      makeGet("http://localhost/api/export/wiki", {
        cookie: `other=1; admin_session=${adminSessionToken(ADMIN_PASSWORD)}; theme=dark`,
      }) as any
    );
    expect(res.status).toBe(200);
  });

});

describe("export route auth — Bearer INGEST_SECRET", () => {
  beforeEach(() => {
    process.env.INGEST_SECRET = INGEST_SECRET;
  });

  it("returns 401 without an Authorization header", async () => {
    const { GET } = await importWikiRoute();
    const res = await GET(makeGet("http://localhost/api/export/wiki") as any);
    expect(res.status).toBe(401);
  });

  it("returns 401 with a wrong bearer token", async () => {
    const { GET } = await importWikiRoute();
    const res = await GET(
      makeGet("http://localhost/api/export/wiki", {
        authorization: "Bearer wrong-secret",
      }) as any
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with the correct bearer token", async () => {
    const { GET } = await importWikiRoute();
    const res = await GET(
      makeGet("http://localhost/api/export/wiki", {
        authorization: `Bearer ${INGEST_SECRET}`,
      }) as any
    );
    expect(res.status).toBe(200);
  });

});

describe("export route auth — both secrets configured", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
    process.env.INGEST_SECRET = INGEST_SECRET;
  });

  it("accepts a valid cookie without a bearer token", async () => {
    const { GET } = await importWikiRoute();
    const res = await GET(
      makeGet("http://localhost/api/export/wiki", {
        cookie: `admin_session=${adminSessionToken(ADMIN_PASSWORD)}`,
      }) as any
    );
    expect(res.status).toBe(200);
  });

  it("accepts a valid bearer token without a cookie", async () => {
    const { GET } = await importWikiRoute();
    const res = await GET(
      makeGet("http://localhost/api/export/wiki", {
        authorization: `Bearer ${INGEST_SECRET}`,
      }) as any
    );
    expect(res.status).toBe(200);
  });

  it("rejects when both are present but invalid", async () => {
    const { GET } = await importWikiRoute();
    const res = await GET(
      makeGet("http://localhost/api/export/wiki", {
        cookie: "admin_session=bad",
        authorization: "Bearer bad",
      }) as any
    );
    expect(res.status).toBe(401);
  });
});

describe("recommendations and chat-log exports are intentionally public", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
    process.env.INGEST_SECRET = INGEST_SECRET;
  });

  it("serves recommendations without any credentials even when both secrets are set", async () => {
    const { GET } = await importRecsRoute();
    const res = await GET(
      makeGet("http://localhost/api/export/recommendations") as any
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
  });

  it("serves the recommendations print-PDF HTML format without credentials", async () => {
    const { GET } = await importRecsRoute();
    const res = await GET(
      makeGet("http://localhost/api/export/recommendations?format=pdf") as any
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("serves the chat log as JSONL without credentials even when both secrets are set", async () => {
    const { GET } = await importChatLogRoute();
    const res = await GET(
      makeGet("http://localhost/api/export/chat-log?month=2026-01") as any
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("x-ndjson");
  });

  it("serves the chat log as CSV without credentials", async () => {
    const { GET } = await importChatLogRoute();
    const res = await GET(
      makeGet("http://localhost/api/export/chat-log?month=2026-01&format=csv") as any
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
  });
});
