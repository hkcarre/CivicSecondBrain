-- Auto-provisions an app_users row when someone signs in for the first
-- time (magic link creates a Supabase auth.users row automatically; this
-- trigger gives them a matching app_users row so RLS policies elsewhere
-- — which all join through app_users to resolve city_id/role — have
-- something to find).
--
-- ASSUMPTION (single-city-per-deployment, matches how this app is deployed
-- today — one Railway service per city, env-var-configured): new users are
-- assigned to whichever city row exists first. This schema supports true
-- multi-city-per-Supabase-project already (every table is city_id-scoped),
-- but a real "which city is this user for" assignment flow (e.g.
-- city-scoped invite links) is a follow-up, not needed at today's
-- one-deployment-per-city scale.
--
-- role defaults to 'public' — the lowest-privilege role. Promoting someone
-- to 'council-member' / 'city-staff' / 'admin' is a manual step (update the
-- row in Supabase's Table Editor, or a future admin UI) until a real
-- invite/approval flow exists.

create function handle_new_auth_user() returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
declare
  default_city_id uuid;
begin
  select id into default_city_id from cities order by created_at asc limit 1;

  if default_city_id is null then
    raise exception 'Cannot provision app_users row: no city exists yet. Seed a city first.';
  end if;

  insert into app_users (id, city_id, role)
  values (new.id, default_city_id, 'public');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
