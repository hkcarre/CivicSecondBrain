-- The `cities` table was the only table in the schema left without RLS
-- enabled (every other table — app_users, facts, forecasts, recommendations,
-- projects, conversations, messages — has it). With RLS disabled, any client
-- holding the anon/publishable key can enumerate every onboarded
-- municipality, including cities not yet publicly launched.
--
-- Every actual read of this table in the app (app/lib/db/cities.ts,
-- app/lib/db/queries/console.ts) goes through the service-role client, which
-- bypasses RLS entirely — nothing in browser code queries `cities` directly.
-- So this enables RLS with NO select policy: deny-by-default for the
-- anon/authenticated roles, matching what the app actually needs.

alter table cities enable row level security;
