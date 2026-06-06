/**
 * POST /api/admin/login
 * Verifies the ADMIN_PASSWORD and sets a signed session cookie.
 */

import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "admin_session";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

async function deriveToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("civic-admin"));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    // Dev mode — no password set; redirect straight to admin
    return NextResponse.json({ ok: true, devMode: true });
  }

  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.password || body.password !== password) {
    // Uniform response time to resist timing attacks
    await new Promise((r) => setTimeout(r, 200));
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await deriveToken(password);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
