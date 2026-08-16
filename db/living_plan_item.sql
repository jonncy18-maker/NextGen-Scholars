-- living_plan_item — the line-item breakdown behind ONE category's planned
-- amount for ONE month. Added 2026-08 with the "Build" tab rebuild.
--
-- Read db/living_budget.sql first: everything there about the two-ledger rule
-- applies unchanged. This table sits entirely inside the SCHOLAR's ledger and
-- must never be summed into `expenses`.
--
-- ── What this is for ────────────────────────────────────────────────────────
-- Before this table, a category's monthly figure was a single number she typed
-- and the reasoning behind it was lost the moment she closed the page. Now she
-- can build it up: "lunch ₱75/day, market run ₱100/week, rice 4 × ₱55/month".
-- living_plan.planned_php remains the single source of truth for the TOTAL —
-- these rows are the working-out that produced it, and the builder writes the
-- rolled-up total back to living_plan on save.
--
-- Therefore a category can be in one of two states, and both are valid:
--   • simple   — a living_plan row with no living_plan_item rows behind it
--   • itemised — a living_plan row whose amount equals the sum of its items
-- Nothing in the app requires items to exist. Do not add a NOT NULL constraint
-- tying living_plan to this table.
--
-- ── The averaged month ──────────────────────────────────────────────────────
-- `basis` records the rhythm she thinks in; the app normalises to a month using
-- an AVERAGE month, not the calendar length of the specific month:
--     day   → × 30.4375   (365.25 / 12)
--     week  → ×  4.3482   (365.25 / 12 / 7)
--     month → ×  1
-- Deliberate: a category built from daily items then reads the SAME figure
-- every month instead of drifting between a 28-day February and a 31-day
-- August. A budget is a plan, not a forecast, and a number that moves for
-- reasons she did not cause reads as a bug and breaks month-to-month
-- comparison. Because these multipliers are the true averages, the ANNUAL
-- total still comes out exactly right. See src/constants.js `itemMonthlyPhp`,
-- which is the one implementation — do not re-derive these constants anywhere.

create table if not exists living_plan_item (
  id          uuid primary key default gen_random_uuid(),

  -- Denormalised from living_category so a scholar-scoped read does not need
  -- the join, matching how living_plan carries `scholar` for the same reason.
  -- The API always derives it from the category rather than the request body.
  scholar     text not null references scholars(scholar_key) on delete cascade,

  category_id uuid not null references living_category(id) on delete cascade,
  month       text not null,                     -- 'YYYY-MM'

  name        text not null,
  qty         numeric not null default 1  check (qty >= 0),
  unit_php    numeric not null default 0  check (unit_php >= 0),

  basis       text not null default 'month'
                check (basis in ('day', 'week', 'month')),

  sort_order  integer not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The builder's only read: every item for one category in one month.
create index if not exists living_plan_item_cat_month_idx
  on living_plan_item (category_id, month);

-- Backs the "carry last month's items forward" lookup, which scans a scholar's
-- items for the most recent month that has any.
create index if not exists living_plan_item_scholar_month_idx
  on living_plan_item (scholar, month);

-- updated_at trigger: see updated_at_trigger.sql (shared across tables).
