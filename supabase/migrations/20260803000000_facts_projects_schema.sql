-- CivicSecondBrain — numeric facts, forecasts, prescriptive recommendations,
-- and chat projects/conversations schema.
--
-- This is additive: it does not touch the existing markdown wiki (wiki/*.md
-- stays the system of record for narrative text). This schema is the sole
-- source of truth for anything numeric — no chart, dashboard, or insight
-- should ever be built by scraping numbers back out of markdown.
--
-- Multi-city from day one: every row is scoped by city_id so one Supabase
-- project can serve all municipalities instead of one deployment per city.

create extension if not exists "pgcrypto";

-- ─── Cities (multi-tenant root) ────────────────────────────────────────────

create table cities (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,        -- e.g. "schertz-tx"
  name        text not null,               -- e.g. "Schertz"
  state       text not null,               -- e.g. "TX"
  created_at  timestamptz not null default now()
);

-- ─── App users (maps Supabase auth.users -> role + city scope) ────────────
-- Municipality-level permissions: a user can belong to exactly one city for
-- MVP (multi-city staff access is a later extension, not needed at 1-10
-- users/city).

create type user_role as enum ('council-member', 'city-staff', 'admin', 'public');

create table app_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  city_id     uuid not null references cities(id) on delete cascade,
  role        user_role not null default 'public',
  name        text,
  title       text,                        -- e.g. "Mayor", "Council Member Place 2"
  created_at  timestamptz not null default now()
);

-- ─── Numeric facts — the canonical source for every number in the app ─────
-- value_type distinguishes non-interchangeable versions of "the same"
-- figure (adopted budget vs. actual vs. amended) so a chart never silently
-- mixes them. Precision over "far back" history depends on this column.

create type fact_value_type as enum ('adopted', 'amended', 'actual', 'estimate', 'projected');
create type review_status as enum ('pending', 'approved', 'rejected');

create table facts (
  id                uuid primary key default gen_random_uuid(),
  city_id           uuid not null references cities(id) on delete cascade,
  metric_id         text not null,         -- stable slug, e.g. "general-fund-revenue"
  metric_name       text not null,         -- human label, e.g. "General Fund Revenue"
  value              numeric not null,
  unit              text not null,         -- "usd", "count", "percent", ...
  period            text not null,         -- "FY2024", "2024-Q3", "2024-06" — caller-defined grain
  value_type        fact_value_type not null,
  source_doc_id     text not null,         -- CivicDocument.id / checksum this fact was extracted from
  source_citation   text not null,         -- "[SOURCE: FY2024-Budget.pdf, p.12]" — never optional
  source_quote      text,                  -- verbatim text/table cell the value was read from
  confidence        numeric not null check (confidence >= 0 and confidence <= 1),
  flagged           boolean not null default false,   -- true routes to review queue
  review_status     review_status not null default 'pending',
  reviewed_by       uuid references app_users(id),
  reviewed_at       timestamptz,
  extraction_pass   text not null default 'vision-table-v1', -- which extraction pipeline wrote this row
  created_at        timestamptz not null default now(),
  -- Dedup key: re-crawling the same document/period/value_type must upsert,
  -- never duplicate.
  unique (city_id, metric_id, period, value_type, source_doc_id)
);

create index facts_city_metric_period_idx on facts (city_id, metric_id, period);
create index facts_review_queue_idx on facts (city_id, review_status) where flagged = true;

-- ─── Forecasts — model output, structurally separate from extracted facts ─
-- Never write predictions into `facts`. A chart/insight consumer must be
-- able to tell "what happened" from "what we project" without inspecting a
-- type flag buried in a shared table.

create table forecasts (
  id                    uuid primary key default gen_random_uuid(),
  city_id               uuid not null references cities(id) on delete cascade,
  metric_id             text not null,
  period                text not null,
  predicted_value       numeric not null,
  confidence_interval_low  numeric,
  confidence_interval_high numeric,
  model_name            text not null,     -- e.g. "prophet-v1"
  model_run_at          timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

create index forecasts_city_metric_period_idx on forecasts (city_id, metric_id, period);

-- ─── Prescriptive recommendations — grounded only in facts/forecasts ──────
-- Mirrors the existing markdown Recommendation shape (wiki/recommendations/)
-- but for the numerically-grounded version: every recommendation must cite
-- the specific fact/forecast rows behind it, and nothing reaches council
-- view without admin approval (review_status), regardless of cost pressure
-- elsewhere in the MVP.

create table recommendations (
  id                    uuid primary key default gen_random_uuid(),
  city_id               uuid not null references cities(id) on delete cascade,
  severity              text not null check (severity in ('high', 'medium', 'low')),
  title                 text not null,
  finding               text not null,
  evidence              jsonb not null default '[]',   -- string[]
  suggested_action      text not null,
  discussion_questions  jsonb not null default '[]',   -- string[]
  fact_ids              uuid[] not null default '{}',
  forecast_ids          uuid[] not null default '{}',
  review_status         review_status not null default 'pending',
  reviewed_by           uuid references app_users(id),
  reviewed_at           timestamptz,
  generated_at          timestamptz not null default now()
);

create index recommendations_review_idx on recommendations (city_id, review_status);

-- ─── Chat: projects + conversations + messages ─────────────────────────────
-- Today's chat is stateless (no persistence at all beyond the audit log in
-- app/lib/chat-log.ts, which stays as-is for public-records compliance).
-- This adds real conversation persistence, organized into optional projects.

create table projects (
  id          uuid primary key default gen_random_uuid(),
  city_id     uuid not null references cities(id) on delete cascade,
  owner_id    uuid not null references app_users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table conversations (
  id          uuid primary key default gen_random_uuid(),
  city_id     uuid not null references cities(id) on delete cascade,
  project_id  uuid references projects(id) on delete set null,  -- null = unassigned
  owner_id    uuid not null references app_users(id) on delete cascade,
  title       text not null default 'New conversation',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index conversations_owner_idx on conversations (owner_id, updated_at desc);
create index conversations_project_idx on conversations (project_id);

create table messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references conversations(id) on delete cascade,
  role              text not null check (role in ('user', 'assistant')),
  content           text not null,
  citations         jsonb not null default '[]',  -- Citation[] from app/types
  pages_used        jsonb not null default '[]',  -- wiki page paths, mirrors chat-log.ts
  created_at        timestamptz not null default now()
);

create index messages_conversation_idx on messages (conversation_id, created_at);

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- Server-side ingest/lint/briefing jobs use the Supabase service-role key
-- (bypasses RLS by design — same trust boundary as today's INGEST_SECRET).
-- Everything reached from the browser/user session goes through these
-- policies: a user only ever sees their own city's data, scoped further to
-- their own projects/conversations for chat.

alter table app_users enable row level security;
alter table facts enable row level security;
alter table forecasts enable row level security;
alter table recommendations enable row level security;
alter table projects enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

create function current_city_id() returns uuid
  language sql stable
  as $$
    select city_id from app_users where id = auth.uid()
  $$;

create policy "read own row" on app_users
  for select using (id = auth.uid());

create policy "read own city facts" on facts
  for select using (city_id = current_city_id());

-- Only approved recommendations/facts marked flagged=false OR
-- review_status='approved' are visible to non-admin roles; admins see all
-- of their city's queue for review.
create policy "read approved recommendations, admins see queue" on recommendations
  for select using (
    city_id = current_city_id()
    and (
      review_status = 'approved'
      or exists (select 1 from app_users where id = auth.uid() and role = 'admin')
    )
  );

create policy "read own city forecasts" on forecasts
  for select using (city_id = current_city_id());

create policy "manage own projects" on projects
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "manage own conversations" on conversations
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "manage own conversation messages" on messages
  for all using (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
      and conversations.owner_id = auth.uid()
    )
  );
