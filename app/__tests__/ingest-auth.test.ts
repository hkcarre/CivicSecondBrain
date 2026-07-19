/**
 * ingest-auth.test.ts
 *
 * Auth tests for the ingest-family mutation routes (/api/ingest/upload used
 * as the representative — all five routes share verifyIngestAccess).
 *
 * These routes accept EITHER a valid admin_session cookie (so the admin
 * panel's buttons work in production) OR an Authorization: Bearer
 * INGEST_SECRET header (for scripts/cron). With neither ADMIN_PASSWORD nor
 * INGEST_SECRET configured, they stay open (dev mode).
 *
 * Regression for the production bug where every admin-panel action returned
 * 401 because the routes accepted only the bearer secret while the browser
 * sent only the session cookie.
 *
 * Auth-passing cases use requests that fail fast AFTER the auth check
 * (unsupported extension / missing file → 400) so no real ingest or AI
 * call ever runs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";

const ADMIN_PASSWORD = "correct-horse-battery-staple";
const INGEST_SECRET = "test-ingest-secret";

// Same derivation as middleware.ts / /api/admin/login:
// HMAC-SHA256(key = ADMIN_PASSWORD, message = "civic-admin"), hex-encoded.
function adminSessionToken(password: string): string {
  return createHmac("sha256", password).update("civic-admin").digest("hex");
}

async function importUploadRoute() {
  vi.resetModules();
  return import("@/api/ingest/upload/route");
}

function makeUpload(
  headers: Record<string, string> = {},
  filename = "image.png"
): Request {
  const fd = new FormData();
  fd.append("file", new File(["fake-bytes"], filename));
  return new Request("http://localhost/api/ingest/upload", {
    method: "POST",
    headers,
    body: fd,
  });
}

beforeEach(() => {
  delete process.env.ADMIN_PASSWORD;
  delete process.env.INGEST_SECRET;
});

afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
  delete process.env.INGEST_SECRET;
});

describe("ingest route auth — dev mode", () => {
  it("is open when neither ADMIN_PASSWORD nor INGEST_SECRET is set (400 for bad file, not 401)", async () => {
    const { POST } = await importUploadRoute();
    const res = await POST(makeUpload());
    expect(res.status).toBe(400); // auth passed; rejected on extension
    const body = await res.json();
    expect(body.message).toMatch(/unsupported file type/i);
  });
});

describe("ingest route auth — admin session cookie (the admin panel path)", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
    process.env.INGEST_SECRET = INGEST_SECRET;
  });

  it("returns 401 with no credentials", async () => {
    const { POST } = await importUploadRoute();
    const res = await POST(makeUpload());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/unauthorized/i);
  });

  it("returns 401 with an invalid cookie", async () => {
    const { POST } = await importUploadRoute();
    const res = await POST(makeUpload({ cookie: "admin_session=wrong-token" }));
    expect(res.status).toBe(401);
  });

  it("accepts a valid admin_session cookie (400 on bad file proves auth passed)", async () => {
    const { POST } = await importUploadRoute();
    const res = await POST(
      makeUpload({ cookie: `admin_session=${adminSessionToken(ADMIN_PASSWORD)}` })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/unsupported file type/i);
  });

  it("accepts the cookie among other cookies", async () => {
    const { POST } = await importUploadRoute();
    const res = await POST(
      makeUpload({
        cookie: `theme=dark; admin_session=${adminSessionToken(ADMIN_PASSWORD)}; other=1`,
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("ingest route auth — Bearer INGEST_SECRET (scripts/cron path)", () => {
  beforeEach(() => {
    process.env.INGEST_SECRET = INGEST_SECRET;
  });

  it("returns 401 with a wrong bearer token", async () => {
    const { POST } = await importUploadRoute();
    const res = await POST(makeUpload({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
  });

  it("accepts the correct bearer token (400 on bad file proves auth passed)", async () => {
    const { POST } = await importUploadRoute();
    const res = await POST(makeUpload({ authorization: `Bearer ${INGEST_SECRET}` }));
    expect(res.status).toBe(400);
  });
});

describe("ingest route auth — ADMIN_PASSWORD set but INGEST_SECRET unset", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  });

  it("requires the cookie (previously this configuration was fully open)", async () => {
    const { POST } = await importUploadRoute();
    const denied = await POST(makeUpload());
    expect(denied.status).toBe(401);

    const allowed = await POST(
      makeUpload({ cookie: `admin_session=${adminSessionToken(ADMIN_PASSWORD)}` })
    );
    expect(allowed.status).toBe(400);
  });
});
