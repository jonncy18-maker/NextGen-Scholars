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

## Phase 5 — Migration: Supabase → Neon + Vercel ✅ Complete (2026-07-04, PR #183)

Full plan: `/root/.claude/plans/linear-launching-dragonfly.md` (Phases A′, B0–B5, C, D).
Cut over from Vite/HashRouter/Supabase to Next.js App Router + Neon (serverless
Postgres) + Neon Auth (Better Auth). **All phases done**, including Phase D
(Supabase decommission).

- **Framework + data layer.** Vite/HashRouter → Next.js App Router (Phase A′).
  Neon project `patient-flower-81986836` ("NGS"); schema ported 1:1 from
  Supabase (19 tables + `updated_at`/touch-trigger on 7 polled tables + the
  `ngs_check_gpa_risk()` trigger, ported verbatim) plus a new
  `public.user_profile` table (`user_id → role, scholar_key`, since Better
  Auth's own `neon_auth.user` table has no field for it). `app/api/**`
  replaces every Supabase table read/write, including a transactional
  submission-approve. `src/hooks/useChanges.js` polls `/api/changes` (~25s)
  in place of the 9 Supabase realtime channels.
- **Auth is Better Auth**, not Stack Auth — an earlier plan assumption was
  corrected after inspecting the live `neon_auth.*` schema. `src/lib/
  auth-client.js` uses `better-auth/react` + the `jwtClient()` plugin.
  Real sign-in for the mentor (`LockScreen.jsx`) and all three scholars
  (`ScholarAuthGate.jsx`) — Claire on her real email, April and Janndilyne on
  placeholder emails (`april@placeholder.nextgenscholars.dev` /
  `janndilyne@placeholder.nextgenscholars.dev`, swappable anytime since
  `user_profile` links by `user_id`, not email).
- **Real pre-existing gaps closed along the way**, not just cosmetic-to-real
  swaps: `GradeEntry`, `EnglishTracking`, `VacationTracker`, and
  `MilestonesTracker` had **no gate at all** before (reachable directly by
  URL); the homepage's login modal and a duplicate sign-in form in
  `entry.jsx` were fake/redundant gates layered in front of the real one
  (removed); Navigator was trusting *any* valid Better Auth session instead
  of verifying it belonged to the mentor — a shared-browser-cookie edge case
  (testing a scholar account in one tab silently downgraded the mentor's own
  dashboard in another) that took two passes to fully fix (see `GET /api/me`
  role-check in both `navigator.jsx` and `app/api/bootstrap/route.js`).
- **AI (Gemini tiered layer)** ported to `app/api/{ask,ask-scholar,
  ask-public}/route.js`. `ask` is mentor-only; `ask-scholar`/`ask-public`
  unauthenticated by design (see CLAUDE.md "Known issues"). Along the way,
  found and fixed several call sites still silently writing to (or reading
  stale data from) the orphaned Supabase tables post-cutover-prep:
  `EnglishIngestPanel.jsx`, `ScholarIngestPanel.jsx`, `ExpenseAskWidget.jsx`,
  `ScholarChatPanel.jsx`.
- **Google Drive document storage was dropped entirely** (mentor and scholar
  sides) — OAuth credential-management overhead (client secrets are
  view-once, 2-secret cap, refresh-token minting) wasn't worth it at this
  program's scale. The `documents` table in Neon is unused but harmless.
- **Public-profile dataset leak — fixed.** The public `claire`/`april`/
  `janndilyne` profile pages were pulling the **entire** Supabase dataset —
  every scholar's raw expenses, everything — through the anonymous key for
  any visitor. This was the original motivating risk for the whole migration
  (see the plan's Context section) and had never actually been fixed until
  partway through this effort. `GET /api/public/profile/[key]` is a curated,
  unauthenticated whitelist: current semester, per-semester GPA history,
  milestone/travel states, an English-hours aggregate — all computed
  server-side. Financial data is reduced to per-bucket totals (mirroring
  `src/utils.js`'s `scholarTotals()` exactly); raw expense rows, mentor
  notes, alerts, submissions, and activity never leave the server. Rejects
  any key outside `{claire, april, janndilyne}` with 404.
- **Numeric-string gotcha, hit repeatedly:** Neon's serverless driver
  stringifies `NUMERIC`/`DECIMAL` columns (`gpa`, grade fields, `amount_php`,
  etc.) to avoid precision loss, unlike Supabase's PostgREST which returned
  JSON numbers — coerce with `Number(...)` before any `.toFixed()`/
  arithmetic on these fields. Watch for this in any code not yet audited.
- **Cutover (Phase C, 2026-07-04):** verified Supabase vs. Neon row-count
  parity across all 17 operational tables immediately before merging;
  found and copied over 2 real expense rows added to production during the
  migration window (Supabase remained `main`'s live backend the entire time).
  GitHub Pages repurposed as a frozen redirect stub (`gh-pages-redirect/`,
  published by `.github/workflows/deploy.yml`) — the old `deploy.yml` built
  a Vite `dist/` that no longer exists post-merge.
- **Phase D (Supabase decommission) — done.** A full-repo audit (run as a
  fresh-context subagent specifically so it wasn't biased by the migration
  session's own assumptions) found the "known remaining touchpoints" list
  above was wrong and incomplete — it caught **three live components the
  original migration missed entirely**: `ProgramDetailsSection.jsx` (a live
  **write** path — the mentor's program-details editor was upserting to
  Supabase's `config` table while `app/api/ask-public/route.js` had been
  reading `program_details` from Neon's `config` table since Phase B5, so
  every edit was invisible to the public AI chat; fixed via new
  `app/api/config/route.js` — turned out neither DB ever actually had a
  `program_details` row, so no data was lost), `MentorHome.jsx` and
  `RiskSection.jsx` (both English-hours reads, ported to the existing
  `/api/english/*` routes). Also found `app/home/[scholar]/page.jsx` had no
  scholar-key whitelist, so any unrecognized URL fell through to a
  "dead code" Supabase legacy path in `ScholarHome.jsx` + the cosmetic
  `ScholarLockGate.jsx` — both deleted; unknown scholar keys now redirect
  home. After those fixes: deleted `src/lib/supabase.js`,
  `src/supabase-loader.js`, `src/supabase-writer.js`,
  `.github/workflows/deploy-functions.yml`, and the `@supabase/supabase-js`
  dependency; moved the SQL schema from `supabase/` to `db/` (recovering
  `grade_entries.sql` and the shared `updated_at`-touch-trigger function,
  both of which had only ever existed live on Neon, never committed
  anywhere); relabeled stale "Supabase" UI copy in `NavBar`/`NavFooter`/
  `NavigatorAI`. **Nothing in this repo depends on Supabase anymore.**
  Decommission finished: a second fresh-context audit sweep (three parallel
  agents — code-reference, plumbing, data-path trace) confirmed zero live
  references; the three `VITE_/SUPABASE_*` GitHub Actions secrets
  (`SUPABASE_ACCESS_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
  were removed; the local `.env.local` Supabase placeholders were deleted; and
  the Supabase project (`rhoxpfuephkuaartuqou`) was **paused** on 2026-07-04
  (data retained, restorable anytime). Still open: drop plaintext passwords
  from `scholars-data.js`'s `config` (now unused dead weight, not a live
  risk); swap April/Janndilyne's placeholder emails for real ones.

---

## AI Intelligence Layer

Tiered system — Tier 1 (smart query, no LLM) handles ~80%, escalates to
Tier 2 (Gemini advisory) or Tier 3 (Gemini ingestion).

See `ROADMAP-AI.md` for full step-by-step status.

**Current position:** Steps 1–16, 19–20 complete. Step 16 (weekly report) awaits an
`ask` edge function redeploy. Step 17 next (Scholar pathway chatbot).

| Step | Area | Status |
|---|---|---|
| 1–13 | Schema, edge functions, Tier 1–3, review UI, coaching, risk alerts, OET readiness, budget trajectory, documents tracker | ✅ Done |
| 19–20 | Multi-file ingest, grade screenshot ingestion | ✅ Done |
| 14 | Career tracker — PNLE → OET → NCLEX → OSCE → AHPRA checklist (`career_steps` table deployed) | ✅ Done |
| 15 | Risk/cohort dashboard — RiskSection on Navigator `/progress` | ✅ Done |
| 16 | Mentor weekly report draft (Tier 2) | ✅ Built · ⏳ redeploy `ask` |
| **17** | **Scholar pathway chatbot** | **Next** |
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

## External English Tracking App — Integration Roadmap

A standalone immersion-style English tracking app (Dreaming Spanish model —
comprehensible-input focused, activity logging, viewing time) is being built
separately. The goal is to have sessions logged there flow into the English
tracking module here so scholars' immersion hours count toward their period
goals alongside mentor-session hours.

### Integration design (planned)

The two apps share the same Supabase project (`jonncy18-NextGenDatabase`).
The external app will write sessions directly to `english_sessions` using the
anon key (same RLS already in place), with an agreed schema:

| Field | Source |
|---|---|
| `scholar` | Scholar key (e.g. `claire`) supplied by the external app's auth |
| `date` | Session date (ISO) |
| `duration_minutes` | Logged immersion time |
| `activity_type` | Mapped category (e.g. `Listening`, `Reading`, `Free Conversation`) |
| `notes` | Episode/source title or brief description (optional) |
| `period_id` | Resolved by the external app at write time (match date to active period) |
| `sem` | Active period label (e.g. `OET Prep S1`) |
| `source` | `'immersion_app'` — new column to distinguish origin (see below) |

### Phases

| Phase | Status | Detail |
|---|---|---|
| A — Schema: `source` column on `english_sessions` | 🔵 Pending | `alter table english_sessions add column if not exists source text default 'manual'` — allows the UI to badge immersion sessions differently |
| B — External app writes to shared Supabase | 🔵 Pending | External app uses the same Supabase URL + anon key; inserts with `source = 'immersion_app'`; forecasts auto-update on next Navigator load |
| C — UI: immersion badge in session history | 🔵 Pending | Session rows in `EnglishTracking.jsx` and `EnglishSection.jsx` show a small `Immersion` chip when `source === 'immersion_app'`; filtering by source in the history view |
| D — Real-time sync | 🔵 Pending | Supabase realtime subscription in Navigator/EnglishTracking refreshes the session list when the external app inserts a row — no manual reload needed |
| E — Scholar auth alignment | 🔵 Pending | Depends on Step 21 (PIN-gated scholar auth). Until then, the external app uses the same client-supplied `scholar` key convention |

### Notes

- The `english_forecasts` upsert already runs automatically after each
  session load — immersion sessions from the external app will be included
  in forecast calculations with no extra wiring needed once Phase B lands.
- The weekly `weekly_target_by_category` breakdown can include immersion
  categories (e.g. `Listening`, `Reading`) so comprehensible-input hours
  count toward the same category targets set in the mentor dashboard.
- No new Edge Functions are needed for Phase A–D; the existing anon RLS
  policies already allow session inserts.

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
