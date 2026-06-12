# NextGen Scholars — AI Intelligence Layer Roadmap

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
  Gemini API       Claude API
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

### Orchestrator (`/ask` Edge Function)

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

### P2 · Tighten Row Level Security
Current RLS policies are overly permissive for anon users. Before exposing the AI layer publicly:
- Restrict anon to `config` table read only
- All scholar data reads require authenticated session
- Add service-role key for Edge Functions (never exposed to client)

### P2 · Human-in-the-loop review UI
Before any AI-generated write hits the database, the mentor or scholar reviews a diff card:
- "Claude read this receipt and extracted 3 expenses. Confirm?"
- Edit fields inline, then confirm or discard

---

## Are we ready to start?

**Steps 1–12 complete. Steps 13–18 defined. Next: Step 13 — Documents tracker page + Supabase Storage integration.**

| Layer | Priority | Status | Gap |
|---|---|---|---|
| Schema & data | P0 | ✅ Done | — |
| Edge Functions | P0 | ✅ Done | — |
| Auth / RLS | P0 (service key) · P2 (hardening) | ✅ / Pending | Service-role key auto-injected in Edge Functions; RLS hardening deferred to Step 18 |
| Context builder | P1 | ✅ Done | — |
| Tier 1 resolver | P1 | ✅ Done | — |
| Tier 2 (Gemini) | P1 | ✅ Done | — |
| Tier 3 (Gemini 2.5 Flash) | P1 | ✅ Done | Migrated from Claude; free tier; UI + review card already built |
| Review UI | P1 | ✅ Done | ReviewCard in NavigatorAI — editable table, confirm/discard, write path |
| Coaching note generator | P1 | ✅ Done | Step 9 |
| Academic risk alerts | P1 | ✅ Done | Step 10 |
| OET readiness assessment | P1 | ✅ Done | Step 11 |
| Budget trajectory | P1 | ✅ Done | Step 12 |
| Documents tracker | P2 | Not started | Step 13 |
| Career tracker | P2 | Not started | Step 14 |
| Risk/cohort dashboard | P2 | Not started | Step 15 |
| Weekly report draft | P2 | Not started | Step 16 |
| Scholar pathway chatbot | P2 | Not started | Step 17 |

**Recommended build order:**

| Step | Priority | Task |
|---|---|---|
| ✅ 1 | P0 | Add `expense_submissions` to schema; verify Supabase migration is complete |
| ✅ 2 | P0 | Build `/api/scholar/:key/summary` Edge Function — single call returning full context bundle |
| ✅ 3 | P1 | Build Tier 1 query resolver — pattern-match question types to SQL, return answers without LLM |
| ✅ 4 | P1 | Test Tier 1 end-to-end on the mentor dashboard; tune until it handles 80%+ of common queries |
| ✅ 5 | P1 | Build scholar context builder (compact JSON for LLM injection) — `context.ts`; includes `SCHEMA_REGISTRY` for future-proofing |
| ✅ 6 | P1 | Wire Gemini for Tier 2 (advisory) — add `GOOGLE_AI_KEY` to Supabase secrets |
| ✅ 7 | P1 | Wire Claude for Tier 3 (ingestion) — model pinned to `claude-sonnet-4-6` |
| ✅ 8 | P1 | Confirmation UI for AI-proposed writes — ReviewCard in NavigatorAI (already built) |
| ✅ 9 | P1 | Coaching note generator — "Draft coaching note" button on each ScholarCard in StatusSection |
| ✅ 10 | P1 | Academic risk alerts — DB trigger on `academics`; surfaces in AlertsSection |
| ✅ 11 | P1 | OET readiness assessment — `oet_readiness` Tier 1 intent + Tier 2 narrative; live progress bar in EnglishSection |
| ✅ 12 | P1 | Budget trajectory projection — client-side burn-rate in StatusSection (green/amber/red) |
| **→ 13** | **P2** | **Documents tracker page + Supabase Storage integration** |
| 10 | P1 | Academic risk alerts — DB trigger on `grade_entries`; surfaces in AlertsSection (Step 9 in Phase 2) |
| 11 | P1 | OET readiness assessment — new `oet_readiness` Tier 1 intent + Tier 2 narrative (Step 10 in Phase 2) |
| 12 | P1 | Budget trajectory projection — client-side burn-rate computation in StatusSection (Step 11 in Phase 2) |
| 13 | P2 | Documents tracker page + Supabase Storage integration (Internal Pages priority 1) |
| 14 | P2 | Career tracker page — PNLE → OET → NCLEX → AHPRA checklist (Internal Pages priority 2) |
| 15 | P2 | Risk/cohort dashboard — Navigator Section 07 (Step 14 in Phase 3) |
| 16 | P2 | Mentor weekly report draft — Tier 2 summary of all scholar activity (Step 12 in Phase 3) |
| 17 | P2 | Scholar pathway chatbot — scoped public widget on claire.html / april.html (Step 13 in Phase 3) |
| 18 | P2 | Tighten RLS; audit anon access; rotate any exposed keys |

---

## API Keys

Both keys stored in Supabase secrets — never exposed to the client.

| Secret | Used by |
|---|---|
| `GOOGLE_AI_KEY` | `/ask` — Tier 2 (Gemini advisory) + Tier 3 (Gemini ingestion) |

---

## Build Status

Steps 1–13, 19–20 complete. Now on Step 14. Tier 3 migrated from Claude to Gemini 2.5 Flash.

| Step | Priority | Status | Description |
|---|---|---|---|
| 1 | P0 | ✅ | `expense_submissions` schema + Supabase migration |
| 2 | P0 | ✅ | `scholar-summary` Edge Function |
| 3 | P1 | ✅ | Tier 1 query resolver (12 intents) |
| 4 | P1 | ✅ | Tier 1 end-to-end testing + tuning |
| 5 | P1 | ✅ | Scholar context builder (`context.ts`) with `SCHEMA_REGISTRY` |
| 6 | P1 | ✅ | Tier 2 — Gemini advisory wired (`GOOGLE_AI_KEY`) |
| 7 | P1 | ✅ | Tier 3 — Gemini 2.5 Flash ingestion (migrated from Claude; uses `GOOGLE_AI_KEY`) |
| 8 | P1 | ✅ | Human-in-the-loop review UI (ReviewCard in NavigatorAI) |
| 9 | P1 | ✅ | Coaching note generator — "Draft coaching note" on each ScholarCard |
| 10 | P1 | ✅ | Academic risk alerts — DB trigger on `academics` → `alerts` table; shown in AlertsSection |
| 11 | P1 | ✅ | OET readiness — `oet_readiness` Tier 1 intent + Tier 2 narrative; live progress bar in EnglishSection |
| 12 | P1 | ✅ | Budget trajectory — client-side burn-rate projection on ScholarCard (green/amber/red) |
| 13 | P2 | ✅ | Documents tracker (section 07) + Supabase Storage integration |
| **→ 14** | **P2** | **Next** | **Career tracker — PNLE → OET → NCLEX → AHPRA checklist** |
| 15 | P2 | — | Risk/cohort dashboard — Navigator Section 08 |
| 16 | P2 | — | Mentor weekly report draft (Tier 2) |
| 17 | P2 | — | Scholar pathway chatbot — scoped public widget on profile pages |
| 18 | P2 | — | Tighten RLS; audit anon access |
| 19 | P2 | ✅ | Multi-file ingest — receipt ingest panel accepts multiple files in one go; items merged into one ReviewCard |
| 20 | P2 | ✅ | Grade screenshot ingestion — new "Ingest grades" tab in Navigator AI (Tier 3); AI import widget on student grade pages (session-gated) |
| 21 | P2 | — | Navigator AI widget in student expense-entry module (requires scholar auth upgrade) |
| 22 | P2 | — | Google Drive storage backend for Documents section (replaces Supabase Storage; 15 GB free vs 500 MB) |

---

## Pending manual step

> **Step 10 trigger not yet deployed.** Run `supabase/gpa_risk_trigger.sql` in the
> [Supabase SQL editor](https://supabase.com/dashboard/project/rhoxpfuephkuaartuqou/sql/new)
> to activate auto-generated GPA risk alerts.

---

## Upcoming: P2 Steps

### Step 13 · Documents tracker ✅

Section 07 in Navigator. Mentor uploads receipts, transcripts, visa docs to Supabase Storage. Per-document status tracking (pending / reviewed / linked). Tier 3 receipt extraction → inline ReviewCard → status becomes `linked` on save.

### Step 14 · Career tracker

New page (`/career/:scholar`). Step-by-step PNLE → OET → NCLEX → OSCE → AHPRA checklist with exam dates, scores, pass/fail status. OET readiness (Step 11) reads from this table.

### Step 15 · Risk/cohort dashboard

New collapsible Navigator section (07). Side-by-side scholar risk view — GPA vs floor, English hours vs target, budget used %, next milestone + days until due, risk flag (On Track / Watch / At Risk). Pure Tier 1 — no LLM.

### Step 16 · Mentor weekly report draft

"Generate weekly report" in NavigatorAI. Tier 2 summarises all scholars' week — GPA updates, expenses, English hours, milestones, deadlines, open actions — into a shareable narrative.

### Step 17 · Scholar pathway chatbot

Lightweight public chat widget on `claire.html` / `april.html`. Scoped to public pathway data only — financials blocked at the server level via a restricted `/ask-public` Edge Function.

### Step 18 · RLS hardening

Restrict anon to `config` read-only. All scholar data reads require authenticated session. Rotate any exposed keys.

### Step 19 · Multi-file ingest ✅

Navigator AI "Ingest receipts" tab now accepts multiple files at once. Files are processed sequentially; all extracted expense items are merged into a single ReviewCard for batch confirmation.

### Step 20 · Grade screenshot ingestion ✅

New "Ingest grades" tab in Navigator AI. Upload a grade report screenshot → Tier 3 Gemini extracts all subjects (UV or K-12 scale) → GradeReviewCard with editable fields → saves to `grade_entries`. Also available as an auth-gated "AI import grade report" widget on the student grade pages (visible only when the mentor is logged in).

### Step 21 · Navigator AI in student expense-entry module

Add an inline AI receipt ingest option to the scholar expense-entry flow (`entry.html`). Requires a scholar-auth upgrade (PIN-based `/ask-public` Edge Function) since the entry form uses anon access.

### Step 22 · Google Drive storage backend

Swap Supabase Storage (500 MB free) for Google Drive (15 GB). Service account stores credentials in Supabase secrets; a proxy Edge Function handles uploads from the browser. `documents.storage_path` stores a Drive file ID instead of a Storage path. Download links become signed Drive URLs.

---

## Phase 4 — Longer-Term

**Predictive milestone tracking (Tier 2)**
"What is the likelihood Claire clears PNLE given her current GPA trajectory?" Requires historical cohort data as calibration context.

**Document ingestion pipeline (Tier 3 extension)**
Extend Tier 3 beyond receipts: academic transcripts → `grade_entries`, OET score reports → `certifications`, visa docs → `deadlines + actions`.

**Peer benchmarking (Tier 2)**
Once 3+ scholars are in the program: "How does Claire's spend compare to others at the same stage?"
