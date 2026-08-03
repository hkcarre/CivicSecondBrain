-- Fix: on_auth_user_created (see 20260803020000) assigned every new signup
-- to "whichever city was created first" — fine when there was exactly one
-- city, wrong now that this Supabase project serves multiple municipalities
-- (Schertz, Cibolo, Converse, Seguin, Universal City, New Braunfels, Live
-- Oak). The login page now passes `city_slug` as auth signup metadata,
-- derived from that deployment's own NEXT_PUBLIC_CITY_NAME/STATE env pair —
-- this reads that instead, falling back to "first city" only if metadata is
-- somehow missing (shouldn't happen via the app's own login page, but keeps
-- old/direct signups from hard-failing).

create or replace function handle_new_auth_user() returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
declare
  target_city_id uuid;
  requested_slug text;
begin
  requested_slug := new.raw_user_meta_data->>'city_slug';

  if requested_slug is not null then
    select id into target_city_id from cities where slug = requested_slug;
  end if;

  if target_city_id is null then
    select id into target_city_id from cities order by created_at asc limit 1;
  end if;

  if target_city_id is null then
    raise exception 'Cannot provision app_users row: no city exists yet. Seed a city first.';
  end if;

  insert into app_users (id, city_id, role)
  values (new.id, target_city_id, 'public');

  return new;
end;
$$;
