/**
 * middleware.ts
 *
 * Protects /admin and its API routes with a signed session cookie.
 *
 * How it works:
 *  1. When ADMIN_PASSWORD is unset (local dev), /admin is open — passthrough with a warning.
 *  2. When ADMIN_PASSWORD is set, the middleware checks for a valid `admin_session` cookie.
 *  3. The cookie value is HMAC-SHA256(ADMIN_PASSWORD, "civic-admin") encoded as hex.
 *     - Simple, stateless, no DB required.
 *     - Rotates automatically when ADMIN_PASSWORD changes.
 *  4. Unauthenticated requests to /admin/* are redirected to /admin/login.
 *  5. The login API route (POST /api/admin/login) verifies the password and sets the cookie.
 */

import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "admin_session";

/**
 * Derive the expected session token from the admin password.
 * Uses the Web Crypto API (available in Edge Runtime).
 */
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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /admin paths (page + its API sub-routes)
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // Always allow the login page and the login/logout API endpoints
  if (
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/")
  ) {
    return NextResponse.next();
  }

  const password = process.env.ADMIN_PASSWORD;

  // Dev mode: no password set → open passthrough
  if (!password) {
    console.warn(
      "[admin-auth] WARNING: ADMIN_PASSWORD is not set. /admin is publicly accessible. Set it in production."
    );
    return NextResponse.next();
  }

  // Check session cookie
  const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (sessionCookie) {
    const expected = await deriveToken(password);
    if (sessionCookie === expected) {
      return NextResponse.next();
    }
  }

  // Not authenticated — redirect to login, preserving the intended destination
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
