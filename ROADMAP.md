# NextGen Scholars — Roadmap / Tech Debt

## Next Up

Ship the scholar app to the Play Store via the **Internal Testing** track. The PWA foundation shipped 2026-07-11; next is packaging it as a TWA (Bubblewrap — stable package id + `.well-known/assetlinks.json`), verifying the Bearer-JWT auth flow inside the installed app on a real device, then a Play Console Internal Testing release with a mentor + scholar email allowlist. Code is Claude Code's; Play Console, signing, and device testing are John's.


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
| D — Live data row | ✅ Done | Her `scholars` row was carried over during the Neon migration (Phase 5) and she has a real Better Auth account like Claire and April — see Phase 5 below. |
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

See `ROADMAP-AI.md` for full step-by-step status. All tiers now run as
`app/api/{ask,ask-scholar,ask-public}/route.js` Next.js routes (ported
verbatim from the pre-migration Supabase Edge Functions) — no separate
function-deploy step, they ship on every push like the rest of the app.

**Current position:** Steps 1–17, 19–21 complete. Step 13 (documents tracker)
and Step 22 (Google Drive storage) were dropped rather than ported — see
CLAUDE.md. Step 18 (RLS hardening) is moot post-migration; the
`ask-scholar` unauthenticated-by-design risk it was meant to mitigate is
tracked instead under "Accepted risks" above.

| Step | Area | Status |
|---|---|---|
| 1–12 | Schema, Tier 1–3, review UI, coaching, risk alerts, OET readiness, budget trajectory | ✅ Done |
| 13 | Documents tracker | ❌ Dropped — Google Drive/Supabase Storage integration removed during Phase 5; `documents` table in Neon is unused |
| 14 | Career tracker — PNLE → OET → NCLEX → OSCE → AHPRA checklist (`career_steps` table) | ✅ Done |
| 15 | Risk/cohort dashboard — RiskSection on Navigator `/progress` | ✅ Done |
| 16 | Mentor weekly report draft (Tier 2) | ✅ Done — live in `app/api/ask/route.js`, no pending deploy |
| 17 | Scholar pathway chatbot | ✅ Done — `PublicAskWidget.jsx` + `app/api/ask-public/route.js` |
| 18 | RLS hardening | ❌ Moot — no RLS layer post-migration; see "Accepted risks" |
| 19–20 | Multi-file ingest, grade screenshot ingestion | ✅ Done |
| 21 | Navigator AI (ingest + ask widget) in the expense-entry module | ✅ Done — `ScholarIngestPanel`/`ExpenseAskWidget` in `entry.jsx` |
| 22 | Google Drive storage backend | ❌ Dropped — see Step 13 |

### Pending manual step

None currently — the GPA risk trigger (`db/gpa_risk_trigger.sql`) and
Janndilyne's `scholars` row both live on Neon already (ported verbatim during
Phase 5).

---

## Security audit follow-ups (2026-06) — historical, pre-Neon-migration

A full-repo audit pass against the old Supabase Edge Function backend
produced these. **Superseded by Phase 5** (the Neon + Vercel migration):
`drive-proxy`, `scholar-summary`, and the Supabase `ask`/`ask-scholar` Edge
Functions no longer exist — everything now runs as `app/api/**` Next.js
route handlers, deployed automatically on every push (no separate function
deploy step). Kept here for audit history only.

| Item | Status |
|---|---|
| `drive-proxy` IDOR (Google Drive document proxy) | Moot — Google Drive document storage was dropped entirely during Phase 5; no proxy exists anymore. |
| `scholar-summary` `qty=0` inflated totals to 1 | ✅ Carried forward correctly — `lib/ai/context.js` (the Neon-era replacement) does not have this bug. |
| `.env` was tracked in git; now untracked + gitignored, `.env.example` added | ✅ Done, still true today. |
| **`ask-scholar` is unauthenticated** — trusts a client-supplied `scholar` key | 🟡 **Still an accepted risk today**, carried into `app/api/ask-scholar/route.js` by design (see CLAUDE.md "Key Rules for Claude Code"). Not fixed by the migration; a real scholar-scoped-auth upgrade is still open work. |
| GPA risk trigger scale-awareness (`scholars.gpa_scale`, `uvToPct` guard) | ✅ Ported to Neon verbatim during Phase 5 (`db/gpa_risk_trigger.sql`) — live today, no pending deploy. |
| Tier 3 standardised on Gemini (Claude code paths removed) | ✅ Carried into the Neon-era `lib/ai/tier3.js` — `ANTHROPIC_KEY` remains unused. |

---

## Accepted risks (carry forward)

### Navigator data is publicly accessible

`scholars-data.js` is a public static asset. The lock password on it is
cosmetic — anyone can read the file directly. Current decision: acceptable
because the owner considers the narrative data minimally private for the
current phase.

**Revisit immediately** before adding bank details, full addresses, medical
records, IDs, or anything the scholars would not want publicly indexed.

### `ask-scholar` is unauthenticated by design

`app/api/ask-scholar/route.js` trusts a client-supplied `scholar` key with no
auth check — matches the pre-migration Supabase Edge Function's behavior
exactly (see CLAUDE.md "Key Rules for Claude Code"), not a regression from
the Neon cutover. Accepted risk for now; do not store sensitive PII before
this route gets real scholar-scoped auth.

### Resolved by Phase 5 (Neon + Better Auth migration) — kept for history

The two risks below described the pre-migration architecture and **no longer
apply**. Every scholar-facing route (`ScholarHome`, `EnglishTracking`,
`GradeEntry`, `VacationTracker`, `MilestonesTracker`, the expense-entry
portal) now sits behind a real Better Auth sign-in (`ScholarAuthGate.jsx`),
verified server-side via `GET /api/me` — not a cosmetic password or a
sessionStorage flag, and there is no Supabase RLS layer to reason about
anymore (Postgres access goes through `lib/auth.js`'s JWT-verified
role/`scholar_key` resolution instead).

- ~~RLS policies are permissive for anon users~~ — moot; there is no RLS
  layer post-migration. Server-side role checks in `app/api/**` are the
  access-control boundary now.
- ~~ScholarHome is public and grants the entry-portal auto-auth~~ — fixed;
  `ScholarHome` now requires real sign-in, and there's no `sessionStorage`
  auto-auth flag for the expense-entry portal to trust.

---

## External English Tracking App — Integration Roadmap

**⚠️ Stale — written against the pre-migration Supabase backend, never
implemented (all phases below are still 🔵 Pending).** The Supabase project
this plan assumed (`jonncy18-NextGenDatabase` / `rhoxpfuephkuaartuqou`) is
paused post-Phase-5; this design needs to be redrafted against Neon
(`app/api/english/sessions/route.js` + a real auth token for the external
app, replacing the anon-key + RLS approach) before any phase here can start.
Kept for the integration *intent* and field mapping, not as an actionable plan.

A standalone immersion-style English tracking app (Dreaming Spanish model —
comprehensible-input focused, activity logging, viewing time) is being built
separately. The goal is to have sessions logged there flow into the English
tracking module here so scholars' immersion hours count toward their period
goals alongside mentor-session hours.

### Integration design (original — needs a Neon-era rewrite)

The two apps shared the same Supabase project. The external app would write
sessions directly to `english_sessions` using the anon key (same RLS already
in place), with an agreed schema:

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

## Native Android app (PWA → TWA → Play Internal Testing) — PLANNED

**Status:** 🟡 In progress — PWA foundation shipped 2026-07-11; TWA/Play steps
still pending. Part of the cross-repo NGS native rollout.
Ship as an installable Android app so scholars install from the Play Store
rather than "Add to Home Screen". Private distribution via the **Internal
Testing** track (email allowlist), not a public listing.

**Sequencing:** NextGen-Immersion is the pilot — the PWA→TWA→Play pipeline is
proven there first, then replicated here. Runbook: `docs/PWA.md` (this repo,
written) + copy Immersion's `docs/PLAY-STORE.md` when ready.

| Step | State | Notes |
|---|---|---|
| PWA foundation | ✅ Done (2026-07-11) | Manifest (`app/manifest.js`), hand-rolled service worker (`public/sw.js`, registered by `src/components/RegisterSW.jsx`), 192/512 + maskable icons (`public/icons/`). SW keeps `/api/**` network-only and **never caches scholar-scoped responses** (bootstrap etc.) — guards the per-scholar isolation bug class; only public pages (`/`, `/faq`, scholar profile pages) + hashed static assets are cached. Verified headless: SW controls the page, offline shell loads, zero `/api` cache entries. |
| TWA package | 🔵 Planned | Bubblewrap/PWABuilder; stable package id (e.g. `com.nextgenscholars.scholars`); `public/.well-known/assetlinks.json`. |
| Auth-in-TWA verify | 🔵 Planned | Bearer-JWT flow works inside the installed app on a real device. |
| Play Internal Testing | 🔵 Planned | John's Play Console account; mentor + scholar email allowlist; opt-in link. |

Owner split: Claude Code does the code; John owns Play Console, signing, upload,
tester list, device testing.

---

## Nice-to-have (no priority)

- **Accessibility pass** — keyboard flow and screen-reader audit across all pages.
- **publicProfile drift** — `currentSemester` block in `scholars-data.js`
  (intro text, subjects list, period label) is hand-authored and can drift when
  the active semester changes. Derive from Neon data or replace with a
  simpler generated label.
- **TypeScript** — frontend is pure JS/JSX; no type checking on component props
  or Neon query results.
- **Test harness** — no unit or integration tests exist.
