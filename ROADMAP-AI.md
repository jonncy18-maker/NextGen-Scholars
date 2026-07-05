# NextGen Scholars — AI Intelligence Layer Roadmap

**Note on terminology:** this doc's step-by-step history was originally
written against the pre-migration Supabase Edge Function backend. As of
Phase 5 (2026-07-04, PR #183), every "Edge Function" mentioned below has been
ported verbatim to a Next.js API route under `app/api/{ask,ask-scholar,
ask-public}/route.js`, backed by `lib/ai/{context,tier1,tier2,tier3,
action}.js`. There is no separate function-deploy step anymore — these ship
on every push like the rest of the app, and `GOOGLE_AI_KEY` lives in
Vercel's project env vars instead of Supabase secrets. Historical step
descriptions below still say "Edge Function" / "Supabase secrets" / "RLS"
where that was true *at the time the step shipped* — read those as history,
not current architecture. See `CLAUDE.md` → "AI layer" for the current state.

## Vision

A tiered intelligence system where most answers come directly from structured data, and LLM calls are reserved for tasks only a language model can do.

```
User query
    │
    ▼
┌─────────────────────────────────┐
│  Smart Query Layer (no LLM)     │  ← always runs first
│  DB lookup · computed answers   │
└──────────────┬──────────────────┘
               │ escalates only if needed
       ┌───────┴────────┐
       ▼                ▼
  Gemini API       Gemini API
  (advisory /      (data ingestion /
  outside info)    multimodal)
```

---

## Architecture

### Tier 1 — Smart Query Layer (no LLM)

Pattern-matches free-text questions to SQL queries. Returns answers without an LLM call. Handles ~80% of common queries.

| Intent | Example |
|---|---|
| `expense_total` / `expense_by_category` | "How much has Claire spent on tuition?" |
| `budget_status` | "Is April over budget?" |
| `gpa_trend` | "How has Claire's GPA changed?" |
| `milestone_status` | "Which milestones are still pending?" |
| `travel_status` | "What travel is planned?" |
| `deadlines` | "What's due this week?" |
| `alerts` | "Any critical issues?" |
| `english_hours` | "How many OET hours has Claire logged?" |
| `oet_readiness` | "OET readiness assessment for Claire" → escalates to Tier 2 |
| `open_actions` | "What action items are open?" |
| `progress_summary` | "Where is Claire in the program?" |
| `recent_expenses` | "Show me Claire's recent expenses" |

### Tier 2 — Gemini (advisory + outside knowledge)

Called when Tier 1 can't answer. Receives full scholar context bundle. Read-only — never writes to DB.

- Advisory / strategy questions
- Regulatory / licensing knowledge
- OET readiness narrative + pace projection
- Coaching note generation (`type: "coach"`)
- Mentor weekly report draft

**Model:** `gemini-2.5-flash`

### Tier 3 — Gemini 2.5 Flash (data ingestion + multimodal)

Called for unstructured input → structured DB write.

- Receipt image → expense line items
- Pasted fee schedule → expense rows
- Grade report screenshot → grade entries
- Returns JSON for human review — never writes directly

**Model:** `gemini-2.5-flash` (free tier — multimodal, structured extraction)

### Orchestrator (`app/api/ask/route.js`, formerly the `/ask` Edge Function)

```
POST /ask
{
  "scholar": "claire",
  "type": "query" | "ingest" | "coach",
  "text": "...",
  "file": { "base64": "...", "mime": "image/jpeg" }  // optional
}
```

Routing (evaluated in order):
1. `type === "ingest"` + file or text → Tier 3 (Gemini)
2. `type === "grade_ingest"` + file or text → Tier 3 (Gemini)
3. `type === "coach"` → Tier 2 (Gemini coaching prompt)
4. `type === "query"` → Tier 1; escalates to Tier 2 if unresolved

The intent classifier is a small rule-based function (keywords + structure heuristics) — not an LLM call itself. LLM calls are reserved for the actual work.

---

## Backend Prerequisites (build these first)

Before connecting any API key, the following foundation work is needed. Each item is tagged with a priority level:

- **P0 — Blocker:** nothing downstream works without this
- **P1 — Required:** needed before LLM keys are wired
- **P2 — Important:** needed before production use, not before initial wiring

### ✅ P0 · Consolidate to Supabase as single source of truth
~~Currently data is split between Google Sheets (operational writes via Apps Script) and Supabase (reads + new writes). The AI layer needs one place to query.~~

- ✅ `expense_submissions` table added to `supabase/schema.sql` and deployed
- ✅ Sheets migration complete — all operational writes go through Supabase
- ✅ Apps Script web app deprecated

### ✅ P0 · Edge Function layer
Edge Functions deployed to Supabase. API keys are stored server-side in Supabase secrets and never reach the client.

```
✅ scholar-summary   → full context bundle for a scholar (profile, academics,
                        milestones, travels, budgets, expenses, alerts,
                        deadlines, open actions, pending submissions)
✅ ask               → orchestrator shell (routes query → Tier 1/2,
                        ingest → Tier 3; tiers wired in P1)
```

### P1 · Structured scholar context builder
A function that takes a scholar key and returns a compact JSON context block — GPA, expenses, milestones, budgets, alerts — suitable for injecting into an LLM prompt. Called by Tiers 2 and 3 before every LLM call.

### P1 · Tier 1 query resolver
The rule-based function that pattern-matches question types to SQL queries and returns answers without an LLM. Must be solid before wiring any LLM — this is what keeps costs low and responses fast.

### P2 · Tighten Row Level Security — ❌ moot post-migration
Was a pre-migration Supabase RLS concern; there is no RLS layer today. See
Step 18 above and `ROADMAP.md` "Accepted risks" for the equivalent
still-open item (`ask-scholar`'s unauthenticated-by-design client-supplied key).

### P2 · Human-in-the-loop review UI
Before any AI-generated write hits the database, the mentor or scholar reviews a diff card:
- "Gemini read this receipt and extracted 3 expenses. Confirm?"
- Edit fields inline, then confirm or discard

---

## Are we ready to start?

**All of P0–P1 plus most of P2 are done. Steps 13 and 22 (Documents tracker /
Google Drive storage) were dropped rather than built out; Step 18 (RLS
hardening) is moot post-Neon-migration. See Build Status table below.**

| Layer | Priority | Status | Gap |
|---|---|---|---|
| Schema & data | P0 | ✅ Done | — |
| API routes (`app/api/**`) | P0 | ✅ Done | Ported from Supabase Edge Functions during Phase 5 |
| Auth | P0 (server auth) · P2 (per-route hardening) | ✅ / Partial | JWT-verified role/`scholar_key` resolution in `lib/auth.js`; `ask-scholar` remains unauthenticated by design (accepted risk, see `ROADMAP.md`) |
| Context builder | P1 | ✅ Done | — |
| Tier 1 resolver | P1 | ✅ Done | — |
| Tier 2 (Gemini) | P1 | ✅ Done | — |
| Tier 3 (Gemini 2.5 Flash) | P1 | ✅ Done | Migrated from Claude; free tier; UI + review card already built |
| Review UI | P1 | ✅ Done | ReviewCard in NavigatorAI — editable table, confirm/discard, write path |
| Coaching note generator | P1 | ✅ Done | Step 9 |
| Academic risk alerts | P1 | ✅ Done | Step 10 |
| OET readiness assessment | P1 | ✅ Done | Step 11 |
| Budget trajectory | P1 | ✅ Done | Step 12 |
| Documents tracker | P2 | ❌ Dropped | Step 13 — Google Drive/Supabase Storage integration removed; `documents` table in Neon is unused |
| Career tracker | P2 | ✅ Done | Step 14 — `career_steps` table live on Neon |
| Risk/cohort dashboard | P2 | ✅ Done | Step 15 — RiskSection (Navigator `/progress`) |
| Weekly report draft | P2 | ✅ Done | Step 16 — live in `app/api/ask/route.js` |
| Scholar pathway chatbot | P2 | ✅ Done | Step 17 — `PublicAskWidget.jsx` + `app/api/ask-public/route.js` |

**Recommended build order (historical):**

| Step | Priority | Task |
|---|---|---|
| ✅ 1 | P0 | Add `expense_submissions` to schema; verify Supabase migration is complete |
| ✅ 2 | P0 | Build `/api/scholar/:key/summary` Edge Function — single call returning full context bundle |
| ✅ 3 | P1 | Build Tier 1 query resolver — pattern-match question types to SQL, return answers without LLM |
| ✅ 4 | P1 | Test Tier 1 end-to-end on the mentor dashboard; tune until it handles 80%+ of common queries |
| ✅ 5 | P1 | Build scholar context builder (compact JSON for LLM injection) — `context.ts`; includes `SCHEMA_REGISTRY` for future-proofing |
| ✅ 6 | P1 | Wire Gemini for Tier 2 (advisory) — add `GOOGLE_AI_KEY` to Supabase secrets |
| ✅ 7 | P1 | Tier 3 (ingestion) standardised on Gemini 2.5 Flash — all Claude code paths and the mentor model toggle removed; `ANTHROPIC_KEY` no longer used |
| ✅ 8 | P1 | Confirmation UI for AI-proposed writes — ReviewCard in NavigatorAI (already built) |
| ✅ 9 | P1 | Coaching note generator — "Draft coaching note" button on each ScholarCard in StatusSection |
| ✅ 10 | P1 | Academic risk alerts — DB trigger on `academics`; surfaces in AlertsSection |
| ✅ 11 | P1 | OET readiness assessment — `oet_readiness` Tier 1 intent + Tier 2 narrative; live progress bar in EnglishSection |
| ✅ 12 | P1 | Budget trajectory projection — client-side burn-rate in StatusSection (green/amber/red) |
| ❌ 13 | P2 | ~~Documents tracker page + Supabase Storage integration~~ — dropped during Phase 5 |
| ✅ 14 | P2 | Career tracker — PNLE → OET → NCLEX → OSCE → AHPRA checklist (`career_steps` table live on Neon) |
| ✅ 15 | P2 | Risk/cohort dashboard — RiskSection on Navigator `/progress` |
| ✅ 16 | P2 | Mentor weekly report draft (Tier 2) — live in `app/api/ask/route.js`, ships on every push |
| ✅ 17 | P2 | Scholar pathway chatbot — `PublicAskWidget.jsx` scoped public widget on profile pages |
| 18 | P2 | ❌ Moot post-migration — no RLS layer; see `ROADMAP.md` "Accepted risks" for the `ask-scholar` auth gap this was meant to cover |

---

## API Keys

`GOOGLE_AI_KEY` lives in Vercel's project env vars — never exposed to the
client (was Supabase secrets pre-migration).

| Secret | Used by |
|---|---|
| `GOOGLE_AI_KEY` | `app/api/{ask,ask-scholar,ask-public}/route.js` — Tier 2 (Gemini advisory) + Tier 3 (Gemini ingestion) |

---

## Build Status

Steps 1–12, 14–17, 19–21 complete. Steps 13 and 22 dropped. Step 18 moot.
Tier 3 migrated from Claude to Gemini 2.5 Flash; the whole AI layer migrated
from Supabase Edge Functions to Next.js API routes during Phase 5.

| Step | Priority | Status | Description |
|---|---|---|---|
| 1 | P0 | ✅ | `expense_submissions` schema, now on Neon |
| 2 | P0 | ✅ | Scholar context bundle — `app/api/bootstrap/route.js` + `lib/ai/context.js` (was the `scholar-summary` Edge Function) |
| 3 | P1 | ✅ | Tier 1 query resolver (12 intents) — `lib/ai/tier1.js` |
| 4 | P1 | ✅ | Tier 1 end-to-end testing + tuning |
| 5 | P1 | ✅ | Scholar context builder (`lib/ai/context.js`) with `SCHEMA_REGISTRY` |
| 6 | P1 | ✅ | Tier 2 — Gemini advisory wired (`GOOGLE_AI_KEY`) — `lib/ai/tier2.js` |
| 7 | P1 | ✅ | Tier 3 — Gemini 2.5 Flash ingestion (migrated from Claude) — `lib/ai/tier3.js` |
| 8 | P1 | ✅ | Human-in-the-loop review UI (ReviewCard in NavigatorAI) |
| 9 | P1 | ✅ | Coaching note generator — "Draft coaching note" on each ScholarCard |
| 10 | P1 | ✅ | Academic risk alerts — DB trigger on `academics` → `alerts` table (`db/gpa_risk_trigger.sql`, live on Neon); shown in AlertsSection |
| 11 | P1 | ✅ | OET readiness — `oet_readiness` Tier 1 intent + Tier 2 narrative; live progress bar in EnglishSection |
| 12 | P1 | ✅ | Budget trajectory — client-side burn-rate projection on ScholarCard (green/amber/red) |
| 13 | P2 | ❌ Dropped | Documents tracker + storage integration — removed during Phase 5; `documents` table in Neon is unused |
| 14 | P2 | ✅ | Career tracker — PNLE → OET → NCLEX → OSCE → AHPRA checklist; `career_steps` table live on Neon |
| 15 | P2 | ✅ | Risk/cohort dashboard — RiskSection (GPA · English · Budget · Milestones) on Navigator `/progress` |
| 16 | P2 | ✅ | Mentor weekly report draft (Tier 2) — `weekly_report` route in `app/api/ask/route.js` + Weekly Report tab in Navigator AI |
| 17 | P2 | ✅ | Scholar pathway chatbot — `PublicAskWidget.jsx` + `app/api/ask-public/route.js` |
| 18 | P2 | ❌ Moot | RLS hardening — no RLS layer post-migration |
| 19 | P2 | ✅ | Multi-file ingest — receipt ingest panel accepts multiple files in one go; items merged into one ReviewCard |
| 20 | P2 | ✅ | Grade screenshot ingestion — "Ingest grades" tab in Navigator AI (Tier 3); AI import widget on student grade pages (session-gated) |
| 21 | P2 | ✅ | Navigator AI (ingest + ask widget) in the expense-entry module — `ScholarIngestPanel`/`ExpenseAskWidget` in `entry.jsx` |
| 22 | P2 | ❌ Dropped | Google Drive storage backend — see Step 13 |

---

## Pending manual step

None currently. Both items that used to require a manual deploy step are
live on Neon/Vercel and ship automatically on every push:

- The `weekly_report` route (Step 16) lives in `app/api/ask/route.js`.
- The GPA risk trigger (Step 10) lives in `db/gpa_risk_trigger.sql`, ported
  to Neon verbatim during Phase 5.

---

## Upcoming: P2 Steps

### Step 13 · Documents tracker ❌ Dropped

Was: Section 07 in Navigator, mentor uploads to Supabase Storage with
per-document status tracking. Dropped during Phase 5 — OAuth
credential-management overhead wasn't worth it at this program's scale. The
`documents` table exists in Neon's schema but is unused.

### Step 14 · Career tracker

New page (`/career/:scholar`). Step-by-step PNLE → OET → NCLEX → OSCE → AHPRA checklist with exam dates, scores, pass/fail status. OET readiness (Step 11) reads from this table.

### Step 15 · Risk/cohort dashboard

New collapsible Navigator section (07). Side-by-side scholar risk view — GPA vs floor, English hours vs target, budget used %, next milestone + days until due, risk flag (On Track / Watch / At Risk). Pure Tier 1 — no LLM.

### Step 16 · Mentor weekly report draft ✅

"Weekly Report" tab in Navigator AI (section + drawer). A `weekly_report` route in `app/api/ask/route.js` builds every scholar's context bundle and asks Tier 2 (Gemini, `tier2WeeklyReport`) to draft a single shareable cohort update — cohort overview, per-scholar bullets (GPA vs floor, spend vs budget, OET hours vs target, next milestone, deadlines, open actions, alerts), and a "Needs attention this week" list. Output is read-only with a copy-to-clipboard button. Live — ships on every push, no manual deploy step.

### Step 17 · Scholar pathway chatbot ✅

`PublicAskWidget.jsx` — public chat widget on the Claire/April/Janndilyne profile pages and the homepage. Scoped to public pathway data only — financials blocked at the server level by `app/api/ask-public/route.js`.

### Step 18 · RLS hardening ❌ Moot

Was: restrict anon to `config` read-only, require authenticated session for all scholar data reads. Moot post-Neon-migration — there is no RLS layer; Postgres access goes through `lib/auth.js`'s JWT-verified role/`scholar_key` resolution instead. The one risk this was meant to cover — `ask-scholar` trusting a client-supplied `scholar` key with no auth check — is still open and tracked as an accepted risk in `ROADMAP.md`.

### Step 19 · Multi-file ingest ✅

Navigator AI "Ingest receipts" tab now accepts multiple files at once. Files are processed sequentially; all extracted expense items are merged into a single ReviewCard for batch confirmation.

### Step 20 · Grade screenshot ingestion ✅

New "Ingest grades" tab in Navigator AI. Upload a grade report screenshot → Tier 3 Gemini extracts all subjects (UV or K-12 scale) → GradeReviewCard with editable fields → saves to `grade_entries`. Also available as an auth-gated "AI import grade report" widget on the student grade pages (visible only when the mentor is logged in).

### Step 21 · Navigator AI in student expense-entry module ✅

`ScholarIngestPanel` (receipt ingest) and `ExpenseAskWidget` (ask widget) are both live in `src/entries/entry.jsx`, gated by the same real Better Auth sign-in (`ScholarAuthGate.jsx`) as the rest of the expense-entry portal.

### Step 22 · Google Drive storage backend ❌ Dropped

Was: swap Supabase Storage for Google Drive. Dropped along with Step 13 (Documents tracker) during Phase 5 — see that step for why.

---

## Phase 4 — Longer-Term

**Predictive milestone tracking (Tier 2)**
"What is the likelihood Claire clears PNLE given her current GPA trajectory?" Requires historical cohort data as calibration context.

**Document ingestion pipeline (Tier 3 extension)**
Extend Tier 3 beyond receipts: academic transcripts → `grade_entries`, OET score reports → `certifications`, visa docs → `deadlines + actions`.

**Peer benchmarking (Tier 2)**
Once 3+ scholars are in the program: "How does Claire's spend compare to others at the same stage?"
