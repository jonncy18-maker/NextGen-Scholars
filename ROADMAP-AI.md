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

### P0 · Consolidate to Supabase as single source of truth
Currently data is split between Google Sheets (operational writes via Apps Script) and Supabase (reads + new writes). The AI layer needs one place to query.

- Add the `expense_submissions` table to `supabase/schema.sql` (currently referenced in code but missing from schema)
- Migrate remaining Sheets-dependent writes to Supabase
- Deprecate or archive the Apps Script web app once migration is done

### P0 · Edge Function layer
Replace direct Supabase client calls with a thin Edge Function API. This is the interface the AI layer will use — and where API keys are securely stored server-side.

```
/api/scholar/:key/summary     → multi-table data bundle
/api/scholar/:key/expenses    → filtered + aggregated expenses
/api/scholar/:key/academics   → GPA history
/api/ask                      → orchestrator entry point
/api/ingest                   → multimodal ingestion entry point
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

**Short answer: yes for the foundation; not yet for the LLM keys.**

| Layer | Priority | Status | Gap |
|---|---|---|---|
| Schema & data | P0 | ~80% ready | `expense_submissions` missing from schema; Sheets/Supabase split |
| Edge Functions | P0 | Not started | Most critical prerequisite — API keys live here |
| Auth / RLS | P0 (service key) · P2 (hardening) | Partial | Supabase Auth works for mentor; service-role key needed for Edge Functions |
| Context builder | P1 | Not started | Needed before any LLM prompt |
| Tier 1 resolver | P1 | Not started | Must be solid before LLM keys are wired |
| Review UI | P2 | Not started | Needed before AI writes go to production |

**Recommended build order:**

| Step | Priority | Task |
|---|---|---|
| 1 | P0 | Add `expense_submissions` to schema; verify Supabase migration is complete |
| 2 | P0 | Build `/api/scholar/:key/summary` Edge Function — single call returning full context bundle |
| 3 | P1 | Build Tier 1 query resolver — pattern-match question types to SQL, return answers without LLM |
| 4 | P1 | Test Tier 1 end-to-end on the mentor dashboard; tune until it handles 80%+ of common queries |
| 5 | P1 | Build scholar context builder (compact JSON for LLM injection) |
| 6 | P1 | Wire Gemini for Tier 2 (advisory) — add `GOOGLE_AI_KEY` to Supabase secrets |
| 7 | P1 | Wire Claude for Tier 3 (ingestion) — add `ANTHROPIC_KEY` to Supabase secrets; start with receipt parsing |
| 8 | P2 | Build confirmation UI for AI-proposed writes |
| 9 | P2 | Tighten RLS; audit anon access; rotate any exposed keys |

---

## API Keys

When ready, both keys are stored in Supabase secrets (not in source code):
- `GOOGLE_AI_KEY` → used only inside the `/api/ask` Edge Function
- `ANTHROPIC_KEY` → used only inside the `/api/ingest` Edge Function

Neither key ever reaches the client browser.
