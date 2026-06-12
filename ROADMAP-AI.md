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

### Tier 3 — Claude (data ingestion + multimodal)

Called for unstructured input → structured DB write.

- Receipt image → expense line items
- Pasted fee schedule → expense rows
- Returns JSON for human review — never writes directly

**Model:** `claude-sonnet-4-6` (pinned — do not use a floating alias)

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
1. `type === "ingest"` + file or text → Tier 3 (Claude)
2. `type === "coach"` → Tier 2 (Gemini coaching prompt)
3. `type === "query"` → Tier 1; escalates to Tier 2 if unresolved

---

## API Keys

Both keys stored in Supabase secrets — never exposed to the client.

| Secret | Used by |
|---|---|
| `GOOGLE_AI_KEY` | `/ask` — Tier 2 (Gemini) |
| `ANTHROPIC_KEY` | `/ask` — Tier 3 (Claude) |

---

## Build Status

All P1 steps complete. Now in P2.

| Step | Priority | Status | Description |
|---|---|---|---|
| 1 | P0 | ✅ | `expense_submissions` schema + Supabase migration |
| 2 | P0 | ✅ | `scholar-summary` Edge Function |
| 3 | P1 | ✅ | Tier 1 query resolver (12 intents) |
| 4 | P1 | ✅ | Tier 1 end-to-end testing + tuning |
| 5 | P1 | ✅ | Scholar context builder (`context.ts`) with `SCHEMA_REGISTRY` |
| 6 | P1 | ✅ | Tier 2 — Gemini advisory wired (`GOOGLE_AI_KEY`) |
| 7 | P1 | ✅ | Tier 3 — Claude ingestion wired (`ANTHROPIC_KEY`); model pinned to `claude-sonnet-4-6` |
| 8 | P1 | ✅ | Human-in-the-loop review UI (ReviewCard in NavigatorAI) |
| 9 | P1 | ✅ | Coaching note generator — "Draft coaching note" on each ScholarCard |
| 10 | P1 | ✅ | Academic risk alerts — DB trigger on `academics` → `alerts` table; shown in AlertsSection |
| 11 | P1 | ✅ | OET readiness — `oet_readiness` Tier 1 intent + Tier 2 narrative; live progress bar in EnglishSection |
| 12 | P1 | ✅ | Budget trajectory — client-side burn-rate projection on ScholarCard (green/amber/red) |
| **→ 13** | **P2** | **Next** | **Documents tracker page + Supabase Storage integration** |
| 14 | P2 | — | Career tracker — PNLE → OET → NCLEX → AHPRA checklist |
| 15 | P2 | — | Risk/cohort dashboard — Navigator Section 07 |
| 16 | P2 | — | Mentor weekly report draft (Tier 2) |
| 17 | P2 | — | Scholar pathway chatbot — scoped public widget on profile pages |
| 18 | P2 | — | Tighten RLS; audit anon access |

---

## Pending manual step

> **Step 10 trigger not yet deployed.** Run `supabase/gpa_risk_trigger.sql` in the
> [Supabase SQL editor](https://supabase.com/dashboard/project/rhoxpfuephkuaartuqou/sql/new)
> to activate auto-generated GPA risk alerts.

---

## Upcoming: P2 Steps

### Step 13 · Documents tracker

New page (`/documents/:scholar`). Scholars upload receipts, transcripts, visa docs. Mentor reviews uploads. Tier 3 receipt extraction fires on upload → ReviewCard confirm-and-save workflow.

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

---

## Phase 4 — Longer-Term

**Predictive milestone tracking (Tier 2)**
"What is the likelihood Claire clears PNLE given her current GPA trajectory?" Requires historical cohort data as calibration context.

**Document ingestion pipeline (Tier 3 extension)**
Extend Tier 3 beyond receipts: academic transcripts → `grade_entries`, OET score reports → `certifications`, visa docs → `deadlines + actions`.

**Peer benchmarking (Tier 2)**
Once 3+ scholars are in the program: "How does Claire's spend compare to others at the same stage?"
