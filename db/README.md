# Database schema (reference)

Historical/reference SQL for the Neon database (`patient-flower-81986836`),
moved here from the old `supabase/` directory as part of the Phase D
Supabase decommission (see `CLAUDE.md`'s "Migration history"). These are
**not applied automatically** — nothing in the app runs these files; they
document what's live on Neon for anyone setting up a fresh environment or
auditing the schema.

- `schema.sql`, `career_steps.sql`, `documents_table.sql`,
  `english_periods.sql`, `english_schema_v2.sql`, `english_schema_v3.sql`,
  `gpa_risk_trigger.sql` — carried over unchanged from the Supabase era.
  **Their `enable row level security`/`create policy` statements are
  vestigial** — Neon has no RLS story, and authorization for every table is
  now enforced at the API layer (`lib/auth.js`'s `requireMentor`/
  `requireScholarOwn`, checked per route in `app/api/**`), not in Postgres.
- `grade_entries.sql` — **recovered from the live database**, 2026-07. This
  table's DDL only ever existed in the running Supabase DB, never committed
  anywhere in this repo, until the Phase D audit caught the gap.
- `updated_at_trigger.sql` — also recovered live. The shared
  `ngs_touch_updated_at()` function + trigger backing `/api/changes`'s
  polling (added during the migration to 7 tables: `activity_log`, `alerts`,
  `career_steps`, `documents`, `expense_submissions`, `expenses`,
  `grade_entries`) — never committed either.

The Deno Edge Functions that used to live in `supabase/functions/` were
ported to `app/api/{ask,ask-scholar,ask-public}/route.js` in Phase B5 and
are not preserved here — see those files for the current implementation.
