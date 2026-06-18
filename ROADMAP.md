# NextGen Scholars — Roadmap / Tech Debt

## Phase 1 — Build system & data correctness ✅ Complete

| Area | Status |
|---|---|
| Build system — Vite adopted | ✅ Done |
| Navigator code split into components | ✅ Done |
| Data state correctness (React state, no mutable module var) | ✅ Done |
| Single source of truth — scholars-data.js + Supabase merge | ✅ Done |
| One canonical source tree — project/ and chats/ removed | ✅ Done |
| Apply/contact delivery — prefilled mailto on homepage | ✅ Done |
| Navigator password reads from Supabase config | ✅ Done |
| Semester expense list on scholar profile pages | ✅ Done |
| Semester control (per-scholar dropdown) in navigator | ✅ Done |

---

## Phase 2 — Refinement ✅ Complete

| Area | Status |
|---|---|
| Scholar cards side by side (3-column grid, mobile stack) | ✅ Done |
| NGS brand mark consistent across all pages | ✅ Done |
| Journey dropdown in top nav (JourneyDropdown.jsx) | ✅ Done |
| Scholar profile pages share homepage nav format | ✅ Done |
| Expense summary above semester expense table | ✅ Done |
| Homepage ← back link on profile pages | ✅ Done |
| FX widget standardisation (PHP/USD · Market/Manual) | ✅ Done |
| Deadlines sort fixed (localeCompare on ISO dates) | ✅ Done |
| Actions checklist write-back to Supabase | ✅ Done |
| Add Expense inline form with optimistic updates | ✅ Done |
| Navigator data Refresh button | ✅ Done |
| Hero meta stats (2 active · 1 paused format) | ✅ Done |
| Track card Apply pre-select | ✅ Done |
| Log section removed from Navigator | ✅ Done |
| Mark as Sent button styling | ✅ Done |

---

## Phase 3 — SPA migration (in progress)

Converting from multi-page app (9 separate HTML entry points) to a single-shell
SPA, with PWA support as the path toward a React Native mobile app.

See `docs/SPA-MIGRATION-ROADMAP.md` for full plan and route map.

| Phase | Status | Detail |
|---|---|---|
| Phase 1 — React Router + single shell | ✅ Done | `index.html` → `App.jsx`, HashRouter, 404.html redirect, legacy URL map |
| Phase 2 — Shared AuthContext | 🔵 Pending | Replace per-page LockScreen + sessionStorage with unified `AuthContext` + `<ProtectedRoute>` |
| Phase 3 — Navigation cleanup | 🔵 Pending | Replace `window.location.href` and `<a href="*.html">` with `useNavigate()` + `<Link>` |
| Phase 4 — PWA | 🔵 Pending | `vite-plugin-pwa`, manifest.json, service worker, offline shell |

---

## Phase 4 — TESDA module (Janndilyne)

A third, **unadvertised** track — **TESDA** — for a single scholar, Janndilyne.
She gets her own public dashboard (like Claire/April) and appears in the private
navigator with everything the other scholars show, with two differences: **no
English hours** and **no vacation/travel tracker**. The track is intentionally not
linked from the public homepage.

Decisions: track code `TESDA` ("NextGen TESDA"); a **single rolling term**
(`currentSem = 'TESDA'`, no semester progression).

| Phase | Status | Detail |
|---|---|---|
| A — Static profile data | ✅ Done | `janndilyne` block in `scholars-data.js`; `publicProfile` omits `travels`/`english`; no `card` (keeps her off the homepage). Placeholder copy pending owner confirmation. |
| B — Public dashboard page | ✅ Done | `src/entries/janndilyne.jsx` (no English fetch, no travels, `englishHours={null}`); route `/janndilyne` + `/janndilyne.html` legacy redirect in `App.jsx`. |
| C — Navigator integration | ✅ Done | `'janndilyne'` added to `STATIC_SCHOLAR_KEYS`; English stat hidden for TESDA in `MentorHome`; English overview grid excludes TESDA; `NAMECLASS`/`SEM_DISPLAY` entries. Travel module already NGN-only. |
| D — Supabase data row | 🔵 Pending | Insert her `scholars` row (see manual step) so she appears in **live** navigator data. The public page already works from static data alone. |
| E — Roadmap | ✅ Done | This section. |

Sections that needed **no change** — Expenses, Grades, Deadlines, Career, Risk,
Documents, Budget, Program Details — read generically off `scholarKeys`, so she
appears automatically once Phase D is in place.

---

## AI Intelligence Layer

Tiered system — Tier 1 (smart query, no LLM) handles ~80%, escalates to
Tier 2 (Gemini advisory) or Tier 3 (Gemini ingestion).

See `ROADMAP-AI.md` for full step-by-step status.

**Current position:** Steps 1–13, 19–20 complete. Step 14 next (Career tracker).

| Step | Area | Status |
|---|---|---|
| 1–13 | Schema, edge functions, Tier 1–3, review UI, coaching, risk alerts, OET readiness, budget trajectory, documents tracker | ✅ Done |
| 19–20 | Multi-file ingest, grade screenshot ingestion | ✅ Done |
| **14** | **Career tracker — PNLE → OET → NCLEX → AHPRA checklist** | **Next** |
| 15 | Risk/cohort dashboard | 🔵 Pending |
| 16 | Mentor weekly report draft (Tier 2) | 🔵 Pending |
| 17 | Scholar pathway chatbot | 🔵 Pending |
| 18 | RLS hardening | 🔵 Pending |
| 21–22 | Navigator AI in entry module · Google Drive storage backend | 🔵 Pending |

### Pending manual step

> Run `supabase/gpa_risk_trigger.sql` in the Supabase SQL editor to activate
> auto-generated GPA risk alerts (Step 10 trigger not yet deployed).

> Insert Janndilyne's `scholars` row (Phase 4D): `scholar_key='janndilyne'`,
> `track='TESDA'`, `first_name='Janndilyne'`, `status='active'`,
> `current_sem='TESDA'`, plus school/city/program/cohort, so she appears in
> live navigator data. No schema change needed.

---

## Security audit follow-ups (2026-06)

A full-repo audit pass produced these. Frontend/contained fixes are done; the
items below the line need deployment or larger work.

| Item | Status |
|---|---|
| `drive-proxy` IDOR — download/get_base64/delete now require the `fileId` to be registered in the `documents` table (was: any authenticated caller could read/delete any file in the mentor's Drive by ID) | ✅ Code done — **needs `supabase functions deploy drive-proxy`** |
| `scholar-summary` `qty=0` inflated totals to 1 (inconsistent with tier1/context) | ✅ Code done — **needs deploy** |
| `.env` was tracked in git; now untracked + gitignored, `.env.example` added | ✅ Done |
| **`ask-scholar` is unauthenticated** — trusts a client-supplied `scholar` key with the service-role key; anyone who knows `claire`/`april` can read that scholar's data | 🟡 **Accepted risk** (owner decision, 2026-06) — data is minimally private for this phase. Real fix is Step 21 (PIN auth) + Step 18 (RLS). See note below. |
| **GPA risk trigger scale-awareness** — trigger is now scale-aware via a `scholars.gpa_scale` column (`percent` default / `uv`), with a defensive guard that skips raw-UV values (≤5) mis-entered under the percent scale. `academics.gpa`/`gpa_floor` remain percentages by default (UV converted via `uvToPct` at entry). | ✅ Code done — **needs re-running `supabase/gpa_risk_trigger.sql`** in the SQL editor |
| **Tier 3 standardised on Gemini** — removed all reachable Claude code paths in `ask`/`ask-scholar`/`tier3.ts` and the mentor model toggle; added a Gemini English-ingest path so English ingest no longer needs `ANTHROPIC_KEY`. `ANTHROPIC_KEY` is now unused. | ✅ Code done — **needs `supabase functions deploy ask ask-scholar`** |

---

## Accepted risks (carry forward)

### Navigator data is publicly accessible

`scholars-data.js` is a public static asset. The lock password is cosmetic —
anyone can read the file directly. Current decision: acceptable because the
owner considers the data minimally private for the current phase.

**Revisit immediately** before adding bank details, full addresses, medical
records, IDs, or anything the scholars would not want publicly indexed.

The Supabase Row Level Security (RLS) hardening (Step 18) is the planned
mitigation for the operational data layer. The static narrative copy in
`scholars-data.js` will always be public while the site is on GitHub Pages.

### RLS policies are permissive for anon users

Current anon access allows reading scholar operational data via the Edge
Functions. Step 18 will restrict anon reads to the `config` table only.
Non-blocking for current phase; **do not store sensitive PII before Step 18.**

Because anon RLS is `using (true)` on every scholar table, the public anon key
can read all scholar data **directly** — so gating `ask-scholar` alone would not
provide confidentiality. Real protection requires the Step 18 RLS hardening, not
just an endpoint check.

### ScholarHome is public and grants the entry-portal auto-auth

`/home/:scholar` (`ScholarHome.jsx`) has no password gate and sets
`sessionStorage['ngs_auth_scholar'] = scholarKey` on mount. The expense-entry
portal (`entry.jsx`) trusts that flag for auto-auth, so visiting `/home/april`
and then opening `/entry?scholar=april` admits the visitor into April's
expense-entry portal without the per-scholar password. Accepted risk for the
current phase (data is minimally private); the real fix is the Step 21 scholar
auth upgrade. Revisit before storing anything sensitive.

---

## Nice-to-have (no priority)

- **Accessibility pass** — keyboard flow and screen-reader audit across all pages.
- **publicProfile drift** — `currentSemester` block in `scholars-data.js`
  (intro text, subjects list, period label) is hand-authored and can drift when
  the active semester changes. Derive from Supabase data or replace with a
  simpler generated label.
- **TypeScript** — frontend is pure JS/JSX; no type checking on component props
  or Supabase query results.
- **Test harness** — no unit or integration tests exist.
