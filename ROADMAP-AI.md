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

## Tier 1 — Smart Query Layer (no LLM)

The backbone of the system. Handles the majority of queries entirely within the database — fast, free, and deterministic.

**What it answers without an LLM:**

| Query type | Example | Method |
|---|---|---|
| Expense totals | "How much has Claire spent on tuition?" | SQL aggregate |
| Budget status | "Is April over budget this semester?" | DB compare |
| GPA trend | "How has Claire's GPA changed?" | Ordered history query |
| Milestone state | "Which milestones are pending?" | Status filter |
| Progress summary | "Where is Claire in the program?" | Multi-table join |
| Alerts / deadlines | "What's due this week?" | Date-range filter |
| English hours | "How many OET hours has Claire logged?" | SUM query |

**How it works:**
- A Supabase Edge Function (`/query`) receives a structured intent (or free-text that is first classified client-side)
- The function resolves it to a SQL query, runs it, and returns a formatted response
- If the question can be answered from the DB with confidence, it returns immediately — no LLM call
- If not, it bundles the relevant DB context and routes to Tier 2 or Tier 3

---

## Tier 2 — Gemini (advisory + outside knowledge)

Called when the user needs information that goes beyond the database.

**When it's invoked:**
- Program strategy questions: "When should Claire sit the OET given her current GPA?"
- Regulatory / licensing questions: "What IELTS score does AHPRA require?"
- Comparison or benchmarking: "Is this spend level normal for a nursing program?"
- Mentor coaching prompts: "Draft a progress note for Claire based on this semester's data"

**What it receives:**
- Structured scholar context (current semester, GPA, expenses, milestone states) assembled by Tier 1
- The user's question
- A system prompt that defines the NGS program, scholar profiles, and response constraints

**What it does NOT do:**
- Ingest images or files (that's Claude's job)
- Mutate data (Gemini is read-only in this system)

---

## Tier 3 — Claude (data ingestion + multimodal)

Called when the input is unstructured and the output is a structured database write.

**When it's invoked:**
- Receipt upload → expense line item(s)
- Screenshot of a tutor invoice → multiple expenses
- Photo of a report card → academic record update
- Pasted fee schedule → budget rows

**What it does:**
1. Receives the file or pasted text plus scholar context (current semester, expense categories)
2. Extracts structured fields matching the DB schema (item, amount, qty, category, date, vendor)
3. Returns a JSON payload for human review before writing
4. On confirmation, the Edge Function writes to Supabase

**Why Claude for this:** Vision + structured extraction in a single call with Anthropic's tool use / JSON mode. Fits the data-ingestion use case cleanly.

**Model:** `claude-sonnet-4-6` — use this model ID explicitly in the Edge Function. Do not use a floating alias (e.g. `claude-sonnet-latest`) — pin the version so extraction behavior is reproducible and cost-predictable.

---

## Orchestrator Logic

A single Supabase Edge Function (`/ask`) acts as the router. It never exposes raw LLM calls to the frontend.

```
POST /ask
{
  "scholar": "claire",
  "type": "query" | "ingest",
  "text": "...",
  "file": { "base64": "...", "mime": "image/jpeg" }  // optional
}
```

Routing rules (evaluated in order):

1. **`type === "ingest"` and file is present** → Tier 3 (Claude)
2. **`type === "ingest"` and text is pasted data** → Tier 3 (Claude)
3. **Intent resolves to a pure DB query** → Tier 1 (no LLM)
4. **Needs outside knowledge** → Tier 2 (Gemini)

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

**Steps 1–6 complete. Steps 7–18 defined. Next: Step 7 — wire Claude for Tier 3 (receipt ingestion).**

| Layer | Priority | Status | Gap |
|---|---|---|---|
| Schema & data | P0 | ✅ Done | — |
| Edge Functions | P0 | ✅ Done | — |
| Auth / RLS | P0 (service key) · P2 (hardening) | ✅ / Pending | Service-role key auto-injected in Edge Functions; RLS hardening deferred to Step 18 |
| Context builder | P1 | ✅ Done | — |
| Tier 1 resolver | P1 | ✅ Done | — |
| Tier 2 (Gemini) | P1 | ✅ Done | — |
| Tier 3 (Claude `claude-sonnet-4-6`) | P1 | Not started | `ANTHROPIC_KEY` needed in Supabase secrets; UI is ready |
| Review UI | P1 | Not started | Needed before AI writes go to production (Step 8) |
| Coaching note generator | P1 | Not started | Step 9 |
| Academic risk alerts | P1 | Not started | Step 10 |
| OET readiness assessment | P1 | Not started | Step 11 |
| Budget trajectory | P1 | Not started | Step 12 |
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
| **→ 7** | **P1** | **Wire Claude for Tier 3 (ingestion) — add `ANTHROPIC_KEY` to Supabase secrets; pin model to `claude-sonnet-4-6`; start with receipt parsing** |
| 8 | P1 | Build confirmation UI for AI-proposed writes (human-in-the-loop review before any DB write) |
| 9 | P1 | Coaching note generator — "Draft note" button in StatusSection (Step 8 in Phase 2) |
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

When ready, both keys are stored in Supabase secrets (not in source code):
- `GOOGLE_AI_KEY` → used only inside the `/api/ask` Edge Function
- `ANTHROPIC_KEY` → used only inside the `/api/ingest` Edge Function

Neither key ever reaches the client browser.

---

## Phase 2 — Immediate Wins (after Step 7)

These are low-effort, high-value additions that build directly on the infrastructure already in place.

### Step 8 · Coaching note generator (Tier 2 · mentor dashboard)

A "Generate coaching note" button on each scholar card in **StatusSection**. Calls Tier 2 (Gemini) with the scholar's live GPA, expenses, English hours, and open actions as context. Returns a drafted weekly check-in talking point the mentor can copy, edit, and send.

- **Input:** scholar context bundle from `scholar-summary` Edge Function
- **Output:** 3–5 bullet prose summary suitable for a mentor update message
- **UI change:** small "Draft note" button on StatusSection card → opens a modal with the generated text + copy button
- **No new Edge Function needed** — routes through the existing `/ask` orchestrator with `type: "coach"`

### Step 9 · Academic risk alerts (Tier 1 · automated)

Auto-generate alerts when a scholar's GPA falls within a configurable threshold of their floor. No LLM call — pure DB comparison.

- **Trigger:** on every `grade_entries` INSERT or UPDATE, compare the computed semester GPA against `scholars.gpa_floor`
- **Thresholds:**
  - Within 5 points of floor → `severity: "warning"` alert: "GPA within 5 points of floor — monitor closely"
  - At or below floor → `severity: "critical"` alert: "GPA at or below minimum — intervention required"
- **Implementation:** Supabase database function + trigger, or scheduled Edge Function check
- **Surfaces in:** AlertsSection (Navigator dashboard)

### Step 10 · OET readiness assessment (Tier 1 + Tier 2)

Query the `/ask` endpoint with "OET readiness" intent. Tier 1 computes: total English hours logged vs. 200-hour target, hours per category (Speaking, Listening, Reading, Writing), pace (hrs/week over last 4 weeks). Tier 2 interprets: "At current pace, Claire reaches her 200-hour target by [date]. Weakest category is Writing — recommend 2 additional sessions/week."

- **New Tier 1 intent:** `oet_readiness` — returns hours by category, total, pace, target gap
- **Tier 2 escalation:** if pace data is available, ask Gemini to produce a plain-language readiness assessment + recommendation
- **Add to quick-prompt buttons** in NavigatorAI Query tab: "OET readiness"
- **Also surface in** EnglishSection as a computed stat: `X hrs / 200 hrs target · on track / behind`

### Step 11 · Budget trajectory (Tier 1 · ExpenseSection)

Show projected semester-end spend based on current burn rate. Pure computation, no LLM.

- **Logic:** total expenses for current semester ÷ weeks elapsed × weeks remaining in semester
- **Display:** a single line below the existing budget bar in StatusSection: "On pace to spend ₱X by end of semester" with a color indicator (green / amber / red vs. budget)
- **Overspend flag:** if projection exceeds budget, show "⚠ Projected overspend of ₱X — review expenses"
- **No new Edge Function** — compute client-side from data already in `DataCtx`

---

## Phase 3 — Medium-Effort Additions

### Step 12 · Mentor weekly report draft (Tier 2)

A "Generate weekly report" action in NavigatorAI. Summarizes all scholars' week: GPA updates, expenses added, English hours logged, milestones reached, deadlines passed, open actions status. Output is a shareable narrative the mentor can paste into an email or message thread.

- **Scope:** all scholars combined, not per-scholar
- **Input:** delta of activity_log entries since last Monday + current snapshot for each scholar
- **Output:** structured narrative with per-scholar sections + a program-level summary paragraph
- **UI:** new quick-prompt button "Weekly report" → generates and displays in a copy-able text block

### Step 13 · Scholar pathway chatbot — public profiles (Tier 1 + Tier 2 · scoped)

A lightweight "Ask about [Scholar]'s pathway" widget on `claire.html` and `april.html`. Scoped strictly to that scholar's public data (no financials, no budget figures, no alerts).

- **Allowed query types:** pathway timeline, milestone status, English stage, program stage, next steps
- **Blocked:** any expense/budget/financial query returns "That information is private"
- **Implementation:** a new restricted `/ask-public` Edge Function that enforces the public-data scope at the server level before hitting Tier 1/2
- **UI:** small collapsible chat widget at the bottom of the scholar profile page

### Step 14 · Risk / cohort dashboard (Navigator Section 07)

A new collapsible section in the Navigator showing all scholars side-by-side at a glance. One-screen risk view replacing the need to read through each section individually.

**Columns per scholar:**
- GPA vs. floor (color-coded)
- English hours vs. target (%)
- Budget used (%)
- Next milestone + days until due
- Last activity date (from activity_log)
- Risk flag: On Track / Watch / At Risk

**Threshold logic:** all Tier 1 — no LLM call. Risk flag is a simple rule: any of (GPA within 5pts of floor, budget >90% used, English pace behind by >20%, next milestone overdue) → "At Risk".

---

## Phase 4 — Longer-Term

### Predictive milestone tracking (Tier 2)
"What is the likelihood Claire clears PNLE given her current GPA trajectory?" Requires historical cohort data as calibration context. Tier 2 (Gemini) with a carefully engineered prompt that sets expectations about uncertainty.

### Document ingestion pipeline (Tier 3 extension)
Extend Tier 3 beyond receipts to parse: academic transcripts → `grade_entries`, visa application documents → `deadlines + actions`, OET score reports → new `certifications` table. Each document type needs its own extraction prompt and review UI.

### Peer benchmarking (Tier 2)
Once there are 3+ scholars in the program, allow queries like "How does Claire's spend compare to other scholars at the same stage?" Tier 1 handles the aggregation; Tier 2 contextualizes the comparison with program norms.

---

## Internal Pages Roadmap

In priority order based on program value and dependency on the AI layer:

| Priority | Page / Feature | What it does | AI tie-in |
|---|---|---|---|
| 1 | **Documents tracker** (`/documents/:scholar`) | Scholars upload receipts, transcripts, visa docs. Mentor reviews uploads. | Tier 3 receipt extraction fires on upload → Confirm & Save workflow |
| 2 | **Career tracker** (`/career/:scholar`) | Step-by-step PNLE → OET → NCLEX → OSCE → AHPRA checklist with exam dates, scores, pass/fail status | OET readiness (Step 10) reads from this table |
| 3 | **Risk/cohort dashboard** (Navigator Section 07) | Side-by-side scholar risk view | Step 14 above |
| 4 | **Mentor notes journal** (Navigator, per-scholar) | Rich-text log of mentor observations per scholar per week | Coaching note generator (Step 8) writes drafts here |
| 5 | **Messages tracker** (`/messages/:scholar`) | Async mentor ↔ scholar messaging via Supabase real-time | Weekly report (Step 12) can auto-post summaries |
| 6 | **Journey stage pages** (`journey-university.html`, etc.) | Deep-dive into each of the 5 pathway stages with timelines, costs, requirements | Scholar pathway chatbot (Step 13) scoped per stage |
