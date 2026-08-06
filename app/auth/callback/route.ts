/**
 * GET /auth/callback
 *
 * Magic-link landing target. Supabase redirects here with a `code` query
 * param after the user clicks the sign-in link in their email; exchanging
 * it establishes the session (via cookies set on the server client) before
 * sending the user on to wherever they were headed.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";

function sanitizeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

/**
 * `req.nextUrl.origin` resolves to the container's own internal bind
 * address (e.g. "https://localhost:8080") rather than the public domain
 * when running behind Railway's edge proxy — confirmed directly: every
 * redirect from this route was silently sending users to localhost instead
 * of back to the app, on every deployment, the whole time this route has
 * existed. The `Host` header (set by the proxy to the public domain) is the
 * reliable source; `X-Forwarded-Host` is checked first in case a future
 * proxy hop changes that convention. Always assumes https — this app never
 * runs production traffic over plain http.
 */
function resolveOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) return `https://${host}`;
  return req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const origin = resolveOrigin(req);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
