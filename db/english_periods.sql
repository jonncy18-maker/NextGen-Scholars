-- English periods / goals — Step 14 supplement
-- Defines date-bounded periods with hour goals per scholar.
-- Run in Supabase SQL editor:
-- https://supabase.com/dashboard/project/rhoxpfuephkuaartuqou/sql/new

create table if not exists english_periods (
  id         bigint generated always as identity primary key,
  scholar    text references scholars(scholar_key) on delete cascade,
  label      text not null,       -- e.g. "Y2S2", "OET Prep S1"
  start_date date not null,
  end_date   date not null,
  hour_goal  numeric not null default 200,
  created_at timestamptz default now()
);

alter table english_periods enable row level security;

-- Mentor: full access
create policy "auth_all_english_periods" on english_periods
  for all to authenticated using (true) with check (true);

-- Scholars / public: read only
create policy "anon_read_english_periods" on english_periods
  for select to anon using (true);
