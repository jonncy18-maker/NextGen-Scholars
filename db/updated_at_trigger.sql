-- Shared touch trigger backing app/api/changes/route.js's polling (replaces
-- the old Supabase realtime channels — see CLAUDE.md's Migration history).
-- Recovered from the live Neon database (Phase D audit, 2026-07): like
-- grade_entries.sql, this was only ever applied live, never committed here.
--
-- Attached to the 7 tables /api/changes polls: activity_log, alerts,
-- career_steps, documents, expense_submissions, expenses, grade_entries.

create or replace function ngs_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_touch_updated_at
  before update on activity_log
  for each row execute function ngs_touch_updated_at();

create trigger trg_touch_updated_at
  before update on alerts
  for each row execute function ngs_touch_updated_at();

create trigger trg_touch_updated_at
  before update on career_steps
  for each row execute function ngs_touch_updated_at();

create trigger trg_touch_updated_at
  before update on documents
  for each row execute function ngs_touch_updated_at();

create trigger trg_touch_updated_at
  before update on expense_submissions
  for each row execute function ngs_touch_updated_at();

create trigger trg_touch_updated_at
  before update on expenses
  for each row execute function ngs_touch_updated_at();

create trigger trg_touch_updated_at
  before update on grade_entries
  for each row execute function ngs_touch_updated_at();
