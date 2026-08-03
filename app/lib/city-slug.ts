/**
 * Pure string helper, no Supabase/server dependency — safe to import from
 * client components (e.g. the login page) as well as server code
 * (app/lib/db/cities.ts). Keeping this in one place matters: the signup
 * trigger resolves a new user's city by this exact slug format, so client
 * and server must compute it identically.
 */
export function cityToSlug(name: string, state: string): string {
  return `${name.toLowerCase().replace(/\s+/g, "-")}-${state.toLowerCase()}`;
}
