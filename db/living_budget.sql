-- living_category / living_plan / allowance — the scholar's OWN living-expense
-- budget (dorm era, from 2026-08). Written directly against Neon: no RLS, no
-- policies — authorization is enforced at the API layer (lib/auth.js's
-- requireScholarOwn, checked per route in app/api/living/**), same as
-- grade_entries.sql.
--
-- ── Why this is NOT the `budgets` table ──────────────────────────────────────
-- `budgets` (schema.sql) is the PROGRAM budget: what the scholarship plans to
-- spend on a scholar per semester. It is John's planning figure.
--
-- These tables are CLAIRE'S budget: her allowance and how she chooses to spend
-- it. Different owner, different money, different cadence. Do not merge them,
-- and do not reuse EXPENSE_CATS here — those are sponsor categories (Tuition,
-- Uniforms, Books); hers are user-defined at runtime (see living_category).
--
-- ── The double-counting rule (read before touching either side) ──────────────
-- The allowance John sends is ONE row in `expenses` (cat 'Living Expenses',
-- bucket 'life') and simultaneously the ENTIRE income line on Claire's side.
-- If her individual line items were also summed into `expenses`, every peso
-- would be counted twice, and the bucket totals published by the public
-- profile pages (app/api/public/profile/[key]) would be inflated.
--
-- Therefore:
--   • mentor/program totals read `expenses` ONLY
--   • the scholar's budget reads `living_*` ONLY
--   • `allowance.expense_id` is the SOLE join between the two ledgers
-- Never SUM across both.
--
-- ── Monthly, not per-semester ───────────────────────────────────────────────
-- The rest of this app is keyed on `sem` ('Y3S1', …). An allowance cycles
-- MONTHLY, so these tables use `month text` in 'YYYY-MM' form. This is a
-- deliberate departure, not an oversight — please don't "fix" it by adding a
-- sem column.

-- ── CATEGORIES (user-defined, owned by the scholar) ─────────────────────────
-- Claire creates these herself; the app seeds a starter set she can rename or
-- archive (src/constants.js LIVING_SEED_CATEGORIES). The seed is a template,
-- NOT a closed enum — anything may be added.
create table if not exists living_category (
  id          uuid primary key default gen_random_uuid(),
  scholar     text not null references scholars(scholar_key) on delete cascade,
  name        text not null,

  -- She names it whatever she likes; `kind` is what the app reasons about.
  --   fixed    — predictable, same every month (dorm rent, wifi)
  --   variable — fluctuates; where tradeoffs and rollover live (food, fuel)
  --   sinking  — NOT billed monthly; accrues toward an irregular cost
  --              (LTO registration, TPL insurance, oil change, tires)
  kind        text not null default 'variable'
                check (kind in ('fixed', 'variable', 'sinking')),

  -- Stable cross-scholar grouping. Scholars invent their own category names,
  -- which would otherwise make April's/Nathalie's budgets incomparable to
  -- Claire's. She names it "Load & Wifi"; it rolls up to 'personal'.
  rollup      text not null default 'personal'
                check (rollup in ('housing', 'food', 'transport',
                                  'school', 'personal', 'savings')),

  -- Sinking-fund maths: monthly accrual = sinking_target_php / sinking_months.
  -- Null for fixed/variable categories.
  sinking_target_php numeric,
  sinking_months     integer check (sinking_months is null or sinking_months > 0),

  -- 'YYYY-MM' of the month the cost actually lands, when she knows it. Drives
  -- the "money leaves this month" marker in the Through December view: the
  -- accrual is what she sets aside monthly, this is when it goes out. Null is
  -- normal — plenty of irregular costs have no known date.
  sinking_due_month  text,

  sort_order  integer not null default 0,

  -- Soft delete. A category with history must never be hard-deleted: the plan
  -- and actual rows referencing it would orphan and her past totals would
  -- silently change. Archiving hides it from new entry and keeps history intact.
  archived_at timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists living_category_scholar_idx
  on living_category (scholar) where archived_at is null;

-- This unique index is load-bearing, not just hygiene: it is what makes the
-- first-visit seed idempotent. The API checks for an existing name before
-- inserting, but that check and the insert are separate round trips — two tabs,
-- a double-tap on a slow connection, or React StrictMode's double-mounted
-- effect can both observe an empty table and both seed. `on conflict do nothing`
-- against this index is the actual guarantee. Case-insensitive because "Food"
-- and "food" are the same category to a human.
create unique index if not exists living_category_scholar_name_key
  on living_category (scholar, lower(name));

-- ── PLAN (her envelope allocation, per category per month) ──────────────────
-- References category_id, never the category NAME — so she can rename freely
-- without orphaning history.
create table if not exists living_plan (
  id          uuid primary key default gen_random_uuid(),
  scholar     text not null references scholars(scholar_key) on delete cascade,
  month       text not null,                     -- 'YYYY-MM'
  category_id uuid not null references living_category(id) on delete cascade,
  planned_php numeric not null default 0,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (category_id, month)
);

create index if not exists living_plan_scholar_month_idx
  on living_plan (scholar, month);

-- ── ALLOWANCE (the bridge between the two ledgers) ──────────────────────────
-- Created now so the boundary is documented in one place; the UI for it lands
-- with Phase 2 (actuals tracking). expense_id points at the single `expenses`
-- row representing John's outflow for this month's allowance.
create table if not exists allowance (
  id          uuid primary key default gen_random_uuid(),
  scholar     text not null references scholars(scholar_key) on delete cascade,
  month       text not null,                     -- 'YYYY-MM'
  amount_php  numeric not null default 0,
  sent_date   date,
  expense_id  text references expenses(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (scholar, month)
);

-- updated_at trigger: see updated_at_trigger.sql (shared across tables).
-- Apply to living_category, living_plan, and allowance when provisioning.
