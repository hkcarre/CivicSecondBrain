-- Strata Operator Console: a cross-city view for Strata's own team, distinct
-- from the existing per-city admin (/admin, ADMIN_PASSWORD-gated) which is
-- scoped to one city's ingestion/wiki management.
--
-- is_strata_admin is orthogonal to the existing per-city `role` column — a
-- user still belongs to exactly one city (schema requirement elsewhere) but
-- this flag grants a cross-city view regardless of that city_id. No
-- self-serve signup path; flip this manually in Supabase's Table Editor for
-- trusted Strata staff accounts only, same trust model as ADMIN_PASSWORD.

alter table app_users add column is_strata_admin boolean not null default false;

-- No RLS policy changes needed: the console route (see app/console/) checks
-- this flag once at the application layer, then reads via the service-role
-- client (bypasses RLS by design, same pattern as the numeric-facts query
-- layer) rather than maintaining a parallel set of cross-city RLS policies
-- for a tool only a couple of trusted people will ever use.
