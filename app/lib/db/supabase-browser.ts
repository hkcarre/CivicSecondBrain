"use client";

/**
 * Session-aware Supabase client for Client Components — used by the login
 * page (to send the magic link) and anywhere the client needs to know the
 * current signed-in user.
 */

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (client) return client;

  // Static member access is required here, not a computed/bracket lookup —
  // Next.js inlines NEXT_PUBLIC_* vars into the browser bundle by literally
  // replacing this exact expression at build time (see app/lib/env.ts's own
  // comment on this same gotcha for server code, where the opposite holds:
  // there, computed access is correct because process.env is the real
  // runtime object). A `process.env[name]` computed lookup like the one
  // this used to have silently resolves to undefined in the browser bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("[db] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. See .env.example.");
  }

  client = createBrowserClient(url, key);
  return client;
}
