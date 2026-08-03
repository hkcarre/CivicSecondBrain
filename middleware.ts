/**
 * middleware.ts
 *
 * Two independent auth systems live here, for two different audiences:
 *
 * 1. /admin — shared-secret ADMIN_PASSWORD session cookie (unchanged, see
 *    below). Internal ingestion/wiki-management tooling, not tied to any
 *    individual user.
 * 2. The chat app (/, /api/chat) and conversation/project APIs — real
 *    per-user Supabase Auth sessions, since conversations/projects are
 *    owned by a specific signed-in user (app_users -> auth.users). Every
 *    matched request also gets its Supabase session cookie refreshed here
 *    (the standard @supabase/ssr middleware pattern), independent of
 *    whether that particular path requires login.
 *
 * How the admin half works:
 *  1. When ADMIN_PASSWORD is unset (local dev), /admin is open — passthrough with a warning.
 *  2. When ADMIN_PASSWORD is set, the middleware checks for a valid `admin_session` cookie.
 *  3. The cookie value is HMAC-SHA256(ADMIN_PASSWORD, "civic-admin") encoded as hex.
 *     - Simple, stateless, no DB required.
 *     - Rotates automatically when ADMIN_PASSWORD changes.
 *  4. Unauthenticated requests to /admin/* are redirected to /admin/login.
 *  5. The login API route (POST /api/admin/login) verifies the password and sets the cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const SESSION_COOKIE = "admin_session";

const SUPABASE_PROTECTED_PATHS = ["/", "/api/chat", "/api/chat/file", "/api/conversations", "/api/projects"];

function isSupabaseProtectedPath(pathname: string): boolean {
  return SUPABASE_PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/**
 * Refreshes the Supabase session cookie for this request (standard
 * @supabase/ssr middleware pattern) and returns the current user, if any.
 * Returns `{ response: null, user: null }` when Supabase env vars aren't
 * configured, so deployments that haven't set up Supabase yet don't 500 —
 * SUPABASE_PROTECTED_PATHS below just won't be enforced in that case.
 */
async function refreshSupabaseSession(
  req: NextRequest
): Promise<{ response: NextResponse; user: { id: string } | null }> {
  let response = NextResponse.next({ request: req });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { response, user: null };
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) {
          req.cookies.set(name, value);
        }
        response = NextResponse.next({ request: req });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}

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

async function handleAdminAuth(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Always allow the login page and the login/logout API endpoints
  if (pathname === "/admin/login" || pathname.startsWith("/api/admin/")) {
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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    return handleAdminAuth(req);
  }

  // Everything else that's matched (see config.matcher below) goes through
  // Supabase session refresh. Only SUPABASE_PROTECTED_PATHS actually
  // require a signed-in user; other matched paths (currently none, but
  // this keeps the door open) just get their session cookie kept fresh.
  const { response, user } = await refreshSupabaseSession(req);

  if (isSupabaseProtectedPath(pathname) && !user) {
    // Supabase not configured at all → don't lock users out of a chat app
    // that has nowhere to send them; only enforce once auth is actually set up.
    const supabaseConfigured = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    if (supabaseConfigured) {
      // API routes get a JSON 401, not a redirect — a `fetch()` caller
      // following a redirect here would land on the login page's HTML and
      // fail trying to parse it as JSON, rather than seeing a clean
      // "not signed in" it can branch on. Only page navigations redirect.
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      }
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/",
    "/login",
    "/auth/callback",
    "/api/chat",
    "/api/chat/file",
    "/api/conversations/:path*",
    "/api/projects/:path*",
  ],
};
