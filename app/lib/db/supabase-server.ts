/**
 * Session-aware Supabase client for Server Components and Route Handlers.
 * Reads/writes the auth session via Next.js cookies — this is what lets
 * `auth.uid()` resolve inside RLS policies for requests made on a signed-in
 * user's behalf (as opposed to app/lib/db/supabase.ts's service-role client,
 * which bypasses RLS entirely and has no notion of "the current user").
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

function read(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === "" ? undefined : value;
}

export async function createServerSupabaseClient() {
  const url = read("NEXT_PUBLIC_SUPABASE_URL");
  const key = read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) {
    throw new Error("[db] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. See .env.example.");
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render (not a Route Handler or
          // Server Action) — cookies can't be set here. Harmless as long as
          // middleware.ts is also refreshing the session, which it is.
        }
      },
    },
  });
}
