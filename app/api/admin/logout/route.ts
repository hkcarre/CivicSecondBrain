/**
 * POST /api/admin/logout
 * Clears the admin session cookie.
 */

import { NextResponse } from "next/server";

const SESSION_COOKIE = "admin_session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
