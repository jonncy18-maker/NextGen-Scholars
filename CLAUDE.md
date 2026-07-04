# NextGen Scholars — Project Context

Private mentorship-program website + mentor dashboard for a privately funded
program supporting Filipino nursing students (NGN track) on a pathway toward
licensure abroad (PH → OET → NCLEX → AHPRA Australia).

- **Repo:** `jonncy18-maker/NextGen-Scholars` (renamed from `NexGen`)
- **Live:** https://next-gen-scholars-jonncy18.vercel.app (Vercel, `main`).
  The old GitHub Pages URL (https://jonncy18-maker.github.io/NextGen-Scholars/)
  is now a frozen redirect stub (`gh-pages-redirect/`) forwarding old
  bookmarks/hash routes to the Vercel domain — it no longer serves the app.
- **Stack:** Next.js 14 (App Router) + React 18, backed by Neon (serverless
  Postgres) + Neon Auth (Better Auth) + Next.js API routes, deployed on
  Vercel. Cut over from Vite/HashRouter/Supabase on **2026-07-04** (PR #183).
  See "Migration history" below for how it got here and what's still
  pending (Phase D: Supabase decommission).

## Build system

A Next.js **App Router** app. `app/**/page.jsx` files are thin `'use client'`
wrappers around the pre-existing screen/component code under `src/` — route params
arrive as the page's `params` prop rather than via `useParams()`. `app/layout.jsx` is
the document shell (global CSS, error boundary). `app/[...legacy]/page.jsx` reproduces
the old legacy-URL redirect behavior (`claire.html`, `navigator.html`, `?scholar=`
query forms, and any other unrecognised path) client-side. Note: full-page components
live in **`src/screens/`**, not `src/pages/` — a directory literally named
`src/pages/` collides with Next.js's (legacy) Pages Router auto-detection.

```bash
npm install
npm run dev      # Next dev server — http://localhost:3000/
npm run build    # Production build (next build)
npm run start    # Serve the production build locally
npm run format   # Prettier — src/**/*.{js,jsx,css}, app/**/*.jsx, and scholars-data.js
```

Env vars are `NEXT_PUBLIC_*` (not Vite's `VITE_*`) — see `.env.example`.
`DATABASE_URL` (server-only, Neon connection string) is required — set in
Vercel project env vars, never committed.

## Routes

| Route | Component | Role |
|---|---|---|
| `/` | `HomePage` | Public homepage (hero, tracks, journey, "Meet the Scholars", apply form). |
| `/claire`, `/april` | Profile pages | Public scholar dashboards (Claire active BSN; April trial Grade 11). |
| `/janndilyne` | Profile page | Public TESDA scholar dashboard (unadvertised — not linked from homepage). |
| `/navigator/*` | `Navigator` | **Private** mentor ops dashboard. Real Better Auth sign-in (`LockScreen.jsx`). |
| `/entry` | Entry app | Scholar-facing data-entry portal. Real Better Auth sign-in (`ScholarAuthGate.jsx`). |
| `/home/:scholar` | `ScholarHome` | Scholar personal dashboard. Real Better Auth sign-in. |
| `/english/:scholar` | `EnglishTracking` | English / OET progress tracking. Real Better Auth sign-in. |
| `/grades/:scholar` | `GradeEntry` | GPA / grade entry. Real Better Auth sign-in. |
| `/vacation/:scholar` | `VacationTracker` | Reward-trip tracker. Real Better Auth sign-in. |
| `/milestones/:scholar` | `MilestonesTracker` | Reward-milestone tracker. Real Better Auth sign-in. |

## Files

| File/Path | Role |
|---|---|
| `app/` | Next.js App Router — file-based routes, each a thin client wrapper. `app/layout.jsx` is the document shell; `app/[...legacy]/page.jsx` is the legacy-URL redirect catch-all; `app/navigator/[[...slug]]/page.jsx` drives Navigator's internal sections. |
| `src/entries/` | Route-level entry components (`navigator.jsx`, `claire.jsx`, `april.jsx`, `janndilyne.jsx`, `entry.jsx`), imported by `app/**/page.jsx`. |
| `src/entries/navigator.jsx` | Root `Navigator` component — manages data state, FX state, polling (`useChanges`), renders the section matching its `slug` prop. |
| `src/screens/` | Full-page components (`HomePage`, `ScholarHome`, `EnglishTracking`, `GradeEntry`, `MilestonesTracker`, `VacationTracker`, `FAQPage`). Named `screens/`, not `pages/`, to avoid colliding with Next's Pages Router auto-detection. |
| `src/components/` | Section-level components (alerts, status cards, nav bar, footer, AI panels, etc.). |
| `src/components/expenses/` | Expense sub-components (charts, filter panel, add form, workbench, sort/filter helpers). |
| `src/components/Profile/` | Scholar profile card components. |
| `src/context/FxContext.jsx` | FX rate context + `useFmt()` formatting hook + `useFxState()`. |
| `src/context/DataContext.jsx` | Data context (`DataCtx`) holding the live merged NGS_DATA snapshot. |
| `src/hooks/` | `useLocalStorage`, `useMediaQuery`, `useScholarProfile`. |
| `src/lib/supabase.js` | Supabase client singleton + `SUPABASE_URL` export. **Legacy** — only `ScholarLockGate.jsx` and `HomePage.jsx` still import it (see "Known issues"); Phase D decommission candidate. |
| `src/constants.js` | Shared UI constants (`EXPENSE_CATS`, `NAMECLASS`, `CAT_TO_BUCKET`). |
| `src/styles/` | CSS (token-based `--ngs-*` vars, Newsreader/Manrope/IBM Plex Mono, navy + gold). |
| `src/supabase-loader.js`, `src/supabase-writer.js` | **Legacy**, superseded by `src/api-loader.js`/`src/api-writer.js` below. Not imported anywhere as of the cutover — confirm with the Phase D audit before deleting. |
| `src/utils.js` | Pure computation helpers (`scholarTotals`, `allExpenses`, `nextMilestone`, `accentFor`, etc.). |
| `src/fx.js` | FX rate helpers — market fetch, localStorage persistence. |
| `scholars-data.js` | Static fallback + narrative/profile/display copy + cosmetic lock password. |
| `supabase/` | **Legacy** SQL schema files + Deno Edge Functions (`ask`, `ask-scholar`, `ask-public`, `scholar-summary`, `drive-proxy`) — ported to `app/api/**` below. Phase D decommission candidate; recovered `grade_entries` DDL here should be preserved into `db/` first (see migration plan Phase D). |
| `lib/db.js` | Lazy Neon serverless client (`@neondatabase/serverless`, HTTP mode) + `selectWhere()` helper. Lazy on purpose — Next's build-time page-data-collection step evaluates route modules, so an eager `neon(...)` call at module scope throws when `DATABASE_URL` isn't set at build time. |
| `lib/auth.js` | JWKS-verified JWT auth (`jose` + `createRemoteJWKSet`, cached) → role/`scholar_key` resolved from `public.user_profile` (never trusted from the token). `requireMentor`/`requireScholarOwn` helpers. |
| `lib/http.js` | `json()` + `withErrorHandling()` response helpers for API routes. |
| `lib/ai/{context,tier1,tier2,tier3,action}.js` | Ported Gemini tiered AI layer (context builder, deterministic tier1 SQL resolver, tier2 advisory, tier3 ingestion, GCash action matching). |
| `src/api-loader.js`, `src/api-writer.js` | Neon-backed replacements for `supabase-loader.js`/`supabase-writer.js` — identical exported names/signatures, so call sites only needed an import-path swap. |
| `app/api/bootstrap/route.js` | Replaces the old 10-way Supabase select; scoped by mentor/scholar role (mentor unscoped, scholar filtered to own `scholar_key`). |
| `app/api/changes/route.js` | Replaces the 9 Supabase realtime channels with polling (`?since=` → `{ now, tables }`), consumed by `src/hooks/useChanges.js`. |
| `app/api/public/profile/[key]/route.js` | Public, unauthenticated curated whitelist backing the public profile pages — see "Public-profile dataset leak" below. |
| `app/api/me/route.js` | Returns `{ role, scholarKey }` for the caller's own token — used by `ScholarAuthGate.jsx` (scholar pages) and `navigator.jsx` (mentor gate) to verify a session actually matches the expected role/scholar before trusting it. |
| `app/api/{ask,ask-scholar,ask-public}/route.js` | Ported Gemini AI orchestrators. `ask` is mentor-only; `ask-scholar`/`ask-public` unauthenticated by design (see "Known issues"). |
| `src/components/ScholarAuthGate.jsx` | Real Better Auth sign-in gate for scholar-facing pages, replacing `ScholarLockGate.jsx`'s cosmetic shared password for migrated scholars (currently all three: Claire, April, Janndilyne). |
| `src/components/ScholarLockGate.jsx` | **Legacy** cosmetic password gate — kept only as a fallback for any future non-migrated scholar; no live call sites currently use it. |
| `src/lib/auth-client.js` | Better Auth React client (`createAuthClient` + `jwtClient()` plugin) pointed at the Neon Auth base URL. `getToken()` reads the JWT off the `set-auth-jwt` response header. |
| `src/lib/api.js` | Fetch wrapper for `app/api/**` — Bearer token per request via `getToken()`, one 401-retry, `afterWrite()` poke hook consumed by `useChanges.js`. |
| `app/sign-in/page.jsx`, `src/entries/sign-in.jsx` | **Temporary** Better Auth test harness at `/sign-in`, not linked from app nav. Was used to live-verify the auth flow during migration; Phase D cleanup candidate. |
| `gh-pages-redirect/` | Static redirect stub (`index.html` + `404.html`, rafgraph/spa-github-pages trick) published to GitHub Pages by `.github/workflows/deploy.yml` — forwards old bookmarks/hash routes to the Vercel domain. No build step; not part of the Next.js app. |

## Data architecture

Three layers, merged at runtime:

- **`scholars-data.js`** — static fallback and narrative fields: scholar bio, English
  profile, public profile copy, program config (`lastUpdated`, `exchangeRate`), and
  the cosmetic lock password. Source of truth for hand-authored fields not held in
  the database.
- **Neon (Postgres)** — operational data: expenses, GPA history, milestone and
  travel states, budgets, alerts, deadlines, action items, English periods,
  career steps. Source of truth for anything the mentor edits week-to-week.
  (Supabase held this data pre-cutover; see "Migration history" below. The
  `documents` table exists in Neon's schema but is unused — the Documents
  feature was dropped rather than ported.)
- **Frontend merge layer** — `src/api-loader.js`'s `loadFromSupabase()` (name
  kept from the pre-migration version for call-site parity) fetches
  `/api/bootstrap` in one call, then `Navigator` / `ScholarHome` merge the
  result with the static narrative fields from `scholars-data.js` and store it
  in React state (`const [D, setD] = useState(NGS_DATA)`). All sections read
  from this merged state via `DataCtx`. `Navigator` polls `/api/changes` via
  `src/hooks/useChanges.js` (~25s) so live edits re-render the dashboard.

When Neon is unreachable, the app falls back to `scholars-data.js` as a static
snapshot (nav shows an offline indicator).

## navigator.jsx + DataContext

- The data snapshot is held in React state inside `Navigator` (not a mutable module
  variable), so polled updates trigger a full re-render of all sections.
- Components read the live snapshot via `useData()` from `DataContext`.
- `scholars-data.js` exports a named ES module export: `export const NGS_DATA = {...}`.
  Import it as `import { NGS_DATA } from '../../scholars-data.js'`.
- **Security note:** the `password` in `scholars-data.js` is **cosmetic only**. The file
  is a public static asset — anyone can read it. Do not treat this as real access control
  (see ROADMAP "Accepted risks").

## Migration history (Supabase → Neon, complete as of 2026-07-04)

Full plan: `/root/.claude/plans/linear-launching-dragonfly.md` (Phases A′, B0–B5, C, D).
Phases A′ through C are done and merged (PR #183, 2026-07-04). **Phase D
(Supabase decommission) is the only phase left** — see below.

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
  unauthenticated by design (see "Known issues"). Along the way, found and
  fixed several call sites still silently writing to (or reading stale data
  from) the orphaned Supabase tables post-cutover-prep: `EnglishIngestPanel.jsx`,
  `ScholarIngestPanel.jsx`, `ExpenseAskWidget.jsx`, `ScholarChatPanel.jsx`.
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
- **Phase D (not started):** delete `supabase/functions/`, `deploy-functions.yml`,
  `@supabase/supabase-js`, and any now-dead Supabase call sites/files (a full
  audit of remaining Supabase references is the planned first step — don't
  assume `src/lib/supabase.js`, `supabase-loader.js`, `supabase-writer.js`,
  `ScholarLockGate.jsx`, or `HomePage.jsx`'s config read are the complete
  list); move SQL files to `db/` as canonical schema (preserve the
  recovered `grade_entries.sql`, which exists only in the live Supabase DB,
  not in the original repo history); drop plaintext passwords from
  `scholars-data.js`'s `config`; pause the Supabase project after a comfort
  window; swap April/Janndilyne's placeholder emails for real ones.

## AI layer

A tiered intelligence system behind the `/api/ask*` routes (`lib/ai/{context,tier1,
tier2,tier3,action}.js`, ported verbatim from the original Supabase Edge Functions).
Tier 1 is a deterministic, rule-based SQL resolver (no LLM, ~80% of queries); Tier 2
is Gemini advisory; Tier 3 is Gemini 2.5 Flash ingestion (receipts, grade reports).
See `ROADMAP-AI.md` for full status. The AI layer is Gemini-only; the `GOOGLE_AI_KEY`
secret lives only in Vercel's project env vars — never in the client.

## Known issues / drift watch

- **`scholars-data.js` narrative drift** — it is the source of truth for narrative/profile
  fields. Profile pages merge Neon operational data on top at runtime. Keep
  `publicProfile` blocks in sync with any Neon-controlled fields (e.g. `currentSem`,
  GPA) referenced in the static copy.
- **`app/api/ask-scholar/route.js` is unauthenticated by design** and trusts a
  client-supplied `scholar` key — this matches the pre-migration Supabase Edge
  Function's behavior exactly, not a regression introduced by the port. Accepted
  risk for now; do not store sensitive PII before real scholar-scoped auth is
  extended to this route.
- **Stale "Sheets" vocabulary** — some state/props/CSS still use `sheets*` naming left
  over from the pre-Supabase Google Sheets backend (predates even the Supabase era).
  Functional, but the names no longer reflect the backend.
- **Phase D Supabase-reference audit not yet run** — `src/lib/supabase.js`,
  `src/supabase-loader.js`, `src/supabase-writer.js`, `ScholarLockGate.jsx`, and
  `HomePage.jsx`'s config read are the *known* remaining Supabase touchpoints,
  but this list hasn't been verified exhaustively against the full codebase yet.
  Don't delete `supabase/` or `@supabase/supabase-js` until that audit confirms
  nothing else depends on them.

## Working in this environment

- **Commits:** GPG signing fails here — commit with
  `git -c commit.gpgsign=false commit -m "..."`.
- **Push:** uses the owner's fine-grained PAT (Contents: write). The token is
  NOT stored in the repo — never commit secrets.
- **Edge Functions (legacy, pre-Phase-D):** code changes under `supabase/functions/`
  only take effect after the owner runs `supabase functions deploy <name>` — they
  are not deployed from this repo, and are no longer live-called by anything in
  `main` (ported to `app/api/**`). Slated for deletion in Phase D.
- **GitHub Pages:** now a frozen redirect stub (`gh-pages-redirect/`), not the
  live app. After changes to it, the Fastly CDN can lag — hard-refresh
  (Cmd/Ctrl+Shift+R) before assuming a redirect fix didn't work.
- **Browser cache:** after a Vercel deploy, a normal reload often serves the old
  file. Tell the user to **hard-refresh** (Cmd/Ctrl+Shift+R).
- **Verifying behavior:** headless Chromium is available —
  `node` + `/opt/node22/lib/node_modules/playwright` (CommonJS `require`) +
  executablePath `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

### Working with Neon/Vercel

- **Neon project:** `patient-flower-81986836` ("NGS") — the live production
  database. **Supabase project** (legacy, pending Phase D decommission):
  `rhoxpfuephkuaartuqou`.
- **Vercel project:** `next-gen-scholars` (team `jonncy18`) — separate from the
  owner's unrelated `next-gen-immersion` project; don't confuse the two.
- **Vercel Deployment Protection** ("Vercel Authentication") must be disabled
  for headless/automated testing of preview deployments — otherwise API routes
  302-redirect to `vercel.com/sso-api` even via `web_fetch_vercel_url`. Only one
  protection level exists on the free tier (no scoped bypass token available).
  `mcp__Vercel__web_fetch_vercel_url` can reach protected/production deployments
  when direct `curl`/`WebFetch` calls 403 from this sandbox's network policy.
- **Connection strings are never fetched into the transcript** — Claude Code's
  safety classifier blocks `mcp__Neon__get_connection_string`. Guide the human
  to copy it manually from the Neon console into Vercel's env var UI instead.
- **`mcp__Neon__run_sql` is one-statement-per-call** (Postgres extended query
  protocol restriction) — DDL/DML with multiple `;`-separated statements, or
  dollar-quoted function bodies via `prepare_database_migration`, must be split
  into individual calls.
- **The sandbox cannot reach the Neon Auth domain, GitHub Pages, or the Vercel
  app domain directly** (network policy) — Better Auth sign-in/JWT flows must be
  tested live in the human's own browser; use `mcp__Vercel__web_fetch_vercel_url`
  for automated checks against deployed Vercel URLs instead of `curl`/`WebFetch`.

## Agentic Loop

Protocolo: https://raw.githubusercontent.com/jonncy18-maker/agentic-loop/main/AGENTIC_LOOP.md
Orquestador: https://raw.githubusercontent.com/jonncy18-maker/agentic-loop/main/orchestrator.js
Al inicio de cada sesión, leer el protocolo completo desde la URL de arriba.

Activate the loop when **any** of these apply: the change touches 3+ files,
creates a new component/module, touches the data layer (queries, schema, AI
context), has user-visible behavior, or is estimated at more than ~5 minutes
of work. For anything smaller — a typo, a one-liner, a single-file config
change — just do it directly, no loop.

The loop runs 6 phases (Understand & Verify → Instructions → Build →
Audit → Iterate → Document) with context isolation between the Build Agent
and the Audit Agent, so the audit is real compliance against the Phase 2
contract rather than a check on the builder's own reasoning. See the full
protocol at the URL above for phase details, control tokens
(`VERDICT: PASS|FAIL|ESCALATE`, `BLOCKER:`), and the Stuck Report format.

## Conventions

- Match the existing inline style of each file (token-based CSS vars `--ngs-*`,
  Newsreader/Manrope/IBM Plex Mono fonts, navy + gold palette).
- Keep internal navigation within the app using Next.js `<Link>` (`next/link`)
  and `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`) — not
  `react-router-dom`, which was removed in the Phase A′ migration.
- Only commit/push when asked. Use `git -c commit.gpgsign=false`.
