/**
 * Tests for POST /api/admin/login and POST /api/admin/logout
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

function makeReq(body: object, url = "http://localhost/api/admin/login"): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/login", () => {
  const originalEnv = process.env.ADMIN_PASSWORD;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ADMIN_PASSWORD;
    } else {
      process.env.ADMIN_PASSWORD = originalEnv;
    }
    vi.resetModules();
  });

  it("returns ok:true with devMode:true when ADMIN_PASSWORD is unset", async () => {
    delete process.env.ADMIN_PASSWORD;
    vi.resetModules();
    const { POST } = await import("@/api/admin/login/route");
    const res = await POST(makeReq({ password: "anything" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.devMode).toBe(true);
  });

  it("returns 401 on wrong password", async () => {
    process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
    vi.resetModules();
    const { POST } = await import("@/api/admin/login/route");
    const res = await POST(makeReq({ password: "wrong" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  it("returns 200 and sets session cookie on correct password", async () => {
    process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
    vi.resetModules();
    const { POST } = await import("@/api/admin/login/route");
    const res = await POST(makeReq({ password: "correct-horse-battery-staple" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("admin_session=");
    expect(cookie).toContain("HttpOnly");
  });

  it("returns 400 on invalid JSON body", async () => {
    process.env.ADMIN_PASSWORD = "secret";
    vi.resetModules();
    const { POST } = await import("@/api/admin/login/route");
    const req = new NextRequest("http://localhost/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/logout", () => {
  it("clears the admin_session cookie", async () => {
    vi.resetModules();
    const { POST } = await import("@/api/admin/logout/route");
    const res = await POST();
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("admin_session=");
    expect(cookie).toContain("Max-Age=0");
  });
});
