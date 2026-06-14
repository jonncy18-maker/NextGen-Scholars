-- Step 14 · Career tracker
-- Run in Supabase SQL editor:
-- https://supabase.com/dashboard/project/rhoxpfuephkuaartuqou/sql/new

create table if not exists career_steps (
  id         bigint generated always as identity primary key,
  scholar    text references scholars(scholar_key) on delete cascade,
  step       text not null check (step in ('PNLE','OET','NCLEX','OSCE','AHPRA')),
  status     text not null default 'pending'
               check (status in ('pending','in_progress','passed','failed','waived')),
  exam_date  date,
  score      text,
  notes      text,
  updated_at timestamptz default now()
);

-- enforce one row per scholar per step
create unique index if not exists career_steps_scholar_step
  on career_steps(scholar, step);

alter table career_steps enable row level security;

-- mentor: full access
create policy "auth_all_career" on career_steps
  for all to authenticated using (true) with check (true);

-- scholars / public: read only
create policy "anon_read_career" on career_steps
  for select to anon using (true);
