-- English tracking — Phase 3: weekly targets, live forecasts, scenario modeling
-- Run in Supabase SQL editor:
-- https://supabase.com/dashboard/project/rhoxpfuephkuaartuqou/sql/new

-- ── Weekly targets on english_periods ─────────────────────────────────────────
-- weekly_target_hours:        flat total per week (e.g. 5)
-- weekly_target_by_category:  per-category weekly target (e.g. {"Free Conversation": 2, ...})
alter table english_periods
  add column if not exists weekly_target_hours        numeric,
  add column if not exists weekly_target_by_category  jsonb default '{}'::jsonb;

-- ── english_forecasts ─────────────────────────────────────────────────────────
-- One row per (scholar, period_id). Upserted from the frontend whenever sessions
-- change so the DB always holds the current best-estimate forecast.
create table if not exists english_forecasts (
  id                 bigint generated always as identity primary key,
  scholar            text    not null references scholars(scholar_key) on delete cascade,
  period_id          bigint  not null references english_periods(id)   on delete cascade,

  actual_hours       numeric not null default 0,
  actual_by_cat      jsonb   default '{}'::jsonb,
  expected_hours     numeric not null default 0,

  pace_hrs_per_week  numeric,
  projected_total    numeric,
  gap_vs_goal        numeric,
  weeks_remaining    numeric,

  status             text    check (status in ('on_track', 'behind', 'at_risk')),
  updated_at         timestamptz default now(),

  unique (scholar, period_id)
);

alter table english_forecasts enable row level security;

create policy "auth_all_english_forecasts" on english_forecasts
  for all to authenticated using (true) with check (true);

create policy "anon_read_english_forecasts" on english_forecasts
  for select to anon using (true);

create policy "anon_insert_english_forecasts" on english_forecasts
  for insert to anon with check (true);

create policy "anon_update_english_forecasts" on english_forecasts
  for update to anon using (true) with check (true);

-- ── english_scenarios ─────────────────────────────────────────────────────────
-- Named what-if models per (scholar, period_id). Each scenario defines a delta
-- on top of the current pace and stores pre-calculated projected outcomes.
create table if not exists english_scenarios (
  id                         bigint generated always as identity primary key,
  scholar                    text    not null references scholars(scholar_key) on delete cascade,
  period_id                  bigint  not null references english_periods(id)   on delete cascade,

  name                       text    not null,         -- e.g. "Add Saturday session"
  description                text,

  additional_hrs_per_week    numeric not null default 0,
  additional_by_category     jsonb   default '{}'::jsonb,

  -- Pre-calculated outcomes (refreshed on save)
  projected_total            numeric,
  projected_completion_date  date,
  gap_vs_goal                numeric,

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table english_scenarios enable row level security;

create policy "auth_all_english_scenarios" on english_scenarios
  for all to authenticated using (true) with check (true);

create policy "anon_read_english_scenarios" on english_scenarios
  for select to anon using (true);
