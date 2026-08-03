/**
 * Supabase client factory.
 *
 * Two distinct trust levels, matching the RLS policies in
 * supabase/migrations/20260803000000_facts_projects_schema.sql:
 *
 * - Service-role client: server-only, bypasses RLS. Used by the ingest/lint/
 *   briefing pipelines (same trust boundary as today's INGEST_SECRET) to
 *   write facts/forecasts/recommendations. NEVER import this in client
 *   components or expose the service-role key to the browser.
 * - Browser/user client: respects RLS, scoped to the signed-in user's city
 *   via the app_users table. Used by the chat UI, dashboard, and charts.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function read(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === "" ? undefined : value;
}

let serviceClient: SupabaseClient | null = null;

/** Server-only client that bypasses RLS. Throws if misconfigured. */
export function getServiceRoleClient(): SupabaseClient {
  if (serviceClient) return serviceClient;

  const url = read("SUPABASE_URL");
  const key = read("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error(
      "[db] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use the service-role client. " +
        "This client is for server-side ingest/lint/briefing jobs only — see .env.example."
    );
  }

  serviceClient = createClient(url, key, {
    auth: { persistSession: false },
  });
  return serviceClient;
}

let browserClient: SupabaseClient | null = null;

/** RLS-respecting client for use in the Next.js app (server components, API routes reading on behalf of a user, and client components). */
export function getBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = read("NEXT_PUBLIC_SUPABASE_URL");
  const key = read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) {
    throw new Error(
      "[db] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. " +
        "See .env.example."
    );
  }

  browserClient = createClient(url, key);
  return browserClient;
}
