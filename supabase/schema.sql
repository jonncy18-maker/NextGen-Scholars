-- NextGen Scholars — Supabase schema
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/rhoxpfuephkuaartuqou/sql/new

-- ── CONFIG ────────────────────────────────────────────────────────────────────
create table if not exists config (
  key   text primary key,
  value text
);

-- Seed required keys (update values as needed)
insert into config (key, value) values
  ('exchangeRate', '56'),
  ('lastUpdated',  '2026-05-30')
on conflict (key) do nothing;

-- ── SCHOLARS ──────────────────────────────────────────────────────────────────
create table if not exists scholars (
  scholar_key   text primary key,
  name          text,
  first_name    text,
  track         text,
  school        text,
  city          text,
  program       text,
  cohort        text,
  status        text,
  current_sem   text,
  gpa_floor     numeric,
  note          text,
  quote         text,
  card_stage    text,
  card_year     text,
  card_progress numeric default 0
);

-- ── ACADEMICS ─────────────────────────────────────────────────────────────────
create table if not exists academics (
  id      bigint generated always as identity primary key,
  scholar text references scholars(scholar_key) on delete cascade,
  sem     text,
  gpa     numeric,
  status  text,
  note    text
);

-- ── MILESTONES ────────────────────────────────────────────────────────────────
create table if not exists milestones (
  id         bigint generated always as identity primary key,
  scholar    text references scholars(scholar_key) on delete cascade,
  name       text,
  state      text,
  sem        text,
  amount_php numeric default 0
);

-- ── TRAVELS ───────────────────────────────────────────────────────────────────
create table if not exists travels (
  id         bigint generated always as identity primary key,
  scholar    text references scholars(scholar_key) on delete cascade,
  dest       text,
  sem        text,
  state      text,
  amount_php numeric default 0
);

-- ── BUDGETS ───────────────────────────────────────────────────────────────────
create table if not exists budgets (
  id         bigint generated always as identity primary key,
  scholar    text references scholars(scholar_key) on delete cascade,
  sem        text,
  amount_php numeric default 0
);

-- ── EXPENSES ──────────────────────────────────────────────────────────────────
create table if not exists expenses (
  id      text primary key,
  scholar text references scholars(scholar_key) on delete cascade,
  sem     text,
  item    text,
  amount  numeric default 0,
  qty     numeric default 1,
  cat     text,
  bucket  text default 'college',
  date    text,
  sent    text,
  avb     text,
  vendor  text default ''
);

-- Migration: add bucket to existing databases
-- alter table expenses add column if not exists bucket text default 'college';

-- ── ALERTS ────────────────────────────────────────────────────────────────────
create table if not exists alerts (
  id       text primary key,
  severity text,
  icon     text,
  scholar  text,
  title    text,
  sub      text
);

-- ── DEADLINES ─────────────────────────────────────────────────────────────────
create table if not exists deadlines (
  id        bigint generated always as identity primary key,
  event     text,
  scholar   text,
  when_date text,
  sort_date text,
  cat       text,
  urgency   text
);

-- ── ACTIONS ───────────────────────────────────────────────────────────────────
create table if not exists actions (
  id      text primary key,
  text    text,
  scholar text,
  cat     text,
  done    boolean default false
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
-- Enable RLS on all tables.

alter table config     enable row level security;
alter table scholars   enable row level security;
alter table academics  enable row level security;
alter table milestones enable row level security;
alter table travels    enable row level security;
alter table budgets    enable row level security;
alter table expenses   enable row level security;
alter table alerts     enable row level security;
alter table deadlines  enable row level security;
alter table actions    enable row level security;

-- Authenticated users (mentor) get full access to everything.
do $$
declare
  t text;
begin
  foreach t in array array[
    'config','scholars','academics','milestones',
    'travels','budgets','expenses','alerts','deadlines','actions'
  ]
  loop
    execute format(
      'create policy "auth_all" on %I for all to authenticated using (true) with check (true)', t
    );
  end loop;
end
$$;

-- ── ENGLISH SESSIONS ─────────────────────────────────────────────────────────
-- Scholar-facing English hours log. Anon (scholar) can read + insert;
-- authenticated (mentor) has full access.
create table if not exists english_sessions (
  id               uuid default gen_random_uuid() primary key,
  scholar          text references scholars(scholar_key) on delete cascade,
  sem              text,
  date             date not null,
  duration_minutes int  not null check (duration_minutes > 0),
  activity_type    text not null,
  notes            text,
  created_at       timestamptz default now()
);

alter table english_sessions enable row level security;

create policy "auth_all_english" on english_sessions
  for all to authenticated using (true) with check (true);

create policy "anon_read_english" on english_sessions
  for select to anon using (true);

create policy "anon_insert_english" on english_sessions
  for insert to anon with check (true);

-- ── ACTIVITY LOG ─────────────────────────────────────────────────────────────
-- Records scholar-initiated expense changes (add/edit/delete_request) so the
-- mentor can review them in real time inside navigator.html.
create table if not exists activity_log (
  id           bigint generated always as identity primary key,
  scholar_key  text not null,
  type         text not null,  -- 'added' | 'edited' | 'delete_request'
  expense_id   text,
  expense_data jsonb,
  changes      jsonb,
  read         boolean default false,
  created_at   timestamptz default now()
);

alter table activity_log enable row level security;

-- Mentor gets full access.
create policy "auth_all_activity" on activity_log
  for all to authenticated using (true) with check (true);

-- Scholars (anon) can only insert new log entries.
create policy "anon_insert_activity" on activity_log
  for insert to anon with check (true);

-- ── ANON READ POLICIES ────────────────────────────────────────────────────────
-- Public scholar profile pages (claire.html, april.html) and the scholar
-- expense-entry form (entry.html) use the anon key without logging in.
-- Grant them read access to the tables they need.

-- config: entry form reads per-scholar passwords (e.g. claire_password).
create policy "anon_read_config"     on config     for select to anon using (true);

-- Scholar profiles need read access to operational tables.
create policy "anon_read_scholars"   on scholars   for select to anon using (true);
create policy "anon_read_academics"  on academics  for select to anon using (true);
create policy "anon_read_milestones" on milestones for select to anon using (true);
create policy "anon_read_travels"    on travels    for select to anon using (true);
create policy "anon_read_budgets"    on budgets    for select to anon using (true);

-- entry form also reads existing expenses and inserts new ones.
create policy "anon_read_expenses"   on expenses   for select to anon using (true);
create policy "anon_insert_expenses" on expenses   for insert to anon with check (true);

-- ── EXPENSE SUBMISSIONS ───────────────────────────────────────────────────────
-- Scholar-submitted expense proposals that require mentor approval before
-- they are committed to the expenses table.
create table if not exists expense_submissions (
  id                 uuid        default gen_random_uuid() primary key,
  scholar_key        text        references scholars(scholar_key) on delete cascade,
  expense_data       jsonb       not null,
  status             text        not null default 'pending'
                                   check (status in ('pending','approved','rejected','resubmitted')),
  rejection_comment  text,
  read_by_scholar    boolean     default false,
  reviewed_at        timestamptz,
  created_at         timestamptz default now()
);

alter table expense_submissions enable row level security;

-- Mentor: full access
create policy "auth_all_submissions" on expense_submissions
  for all to authenticated using (true) with check (true);

-- Scholars (anon): insert new submissions; read and update their own
create policy "anon_insert_submissions" on expense_submissions
  for insert to anon with check (true);

create policy "anon_read_submissions" on expense_submissions
  for select to anon using (true);

create policy "anon_update_submissions" on expense_submissions
  for update to anon using (true) with check (true);
