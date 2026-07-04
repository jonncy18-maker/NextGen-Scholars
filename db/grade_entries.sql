-- grade_entries — per-subject grade records (GradeEntry.jsx / GradesSection.jsx).
--
-- Recovered from the live database during the Neon migration (Phase D audit,
-- 2026-07): this table's DDL only ever existed in the running Supabase
-- database, never committed to this repo's SQL files. Reconstructed here from
-- Neon's live schema (patient-flower-81986836), where the table was ported
-- verbatim during Phase B0's data migration.
--
-- Unlike the other files in this directory, this one was never a Supabase RLS
-- table with policies — it's written directly against Neon, where
-- authorization is enforced at the API layer (lib/auth.js), not RLS.

create table if not exists grade_entries (
  id          uuid primary key default gen_random_uuid(),
  scholar     text references scholars(scholar_key),
  sem         text not null,
  subject     text not null,
  units       numeric not null default 3,
  prelim      numeric,
  midterm     numeric,
  final_grade numeric,
  period_avg  numeric,
  pct_equiv   numeric,
  school      text default 'uv',
  created_at  timestamptz default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at trigger: see updated_at_trigger.sql (shared across 7 tables).
