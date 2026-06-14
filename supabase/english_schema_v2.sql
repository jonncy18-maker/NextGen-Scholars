-- English tracking schema additions — Phase 2 (session types + per-category goals)
-- Run in Supabase SQL editor:
-- https://supabase.com/dashboard/project/rhoxpfuephkuaartuqou/sql/new

-- session_type drives which activity categories are available for a period.
-- Values: 'summer_bootcamp' | 'oet_prep' (add more as needed)
alter table english_periods
  add column if not exists session_type text default 'summer_bootcamp';

-- category_goals stores per-category expected hours as JSON.
-- Example: {"Free Conversation": 40, "Travel": 20, "Visa Interview": 30, "Medical English": 20}
alter table english_periods
  add column if not exists category_goals jsonb default '{}'::jsonb;

-- period_id on english_sessions links a session to its english_period (optional back-link).
-- Useful for fast filtering without relying on date-range joins.
alter table english_sessions
  add column if not exists period_id bigint references english_periods(id) on delete set null;
