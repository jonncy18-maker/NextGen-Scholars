# NextGen Scholars — Project Context

Private mentorship-program website + mentor dashboard for a privately funded
program supporting Filipino nursing students (NGN track) on a pathway toward
licensure abroad (PH → OET → NCLEX → AHPRA Australia).

- **Repo:** `jonncy18-maker/NextGen-Scholars` (renamed from `NexGen`)
- **Live:** https://jonncy18-maker.github.io/NextGen-Scholars/ (GitHub Pages, `main`) —
  **migrating to Vercel**; see `neon-migration` branch and the migration plan.
- **Stack (on `main`, live):** Vite + React 18 + React Router v6 (`HashRouter`),
  Supabase (Postgres + Edge Functions), GitHub Pages.
- **Stack (on this branch, `neon-migration`, in progress):** Next.js 14 (App
  Router) + React 18, backed by Neon (serverless Postgres) + Neon Auth (Better
  Auth) + Next.js API routes on Vercel, replacing Supabase's
  Postgres+PostgREST+GoTrue+Realtime+Edge Functions stack. This file (and the
  rest of this branch) documents the **target** architecture — `main` has not
  been migrated yet. See "Neon migration status" below.

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

Env vars are `NEXT_PUBLIC_*` (not Vite's `VITE_*`) — see `.env.example`. On
`neon-migration`, `DATABASE_URL` (server-only, Neon connection string) is also
required — set in Vercel project env vars, never committed.

## Routes

| Route | Component | Role |
|---|---|---|
| `/` | `HomePage` | Public homepage (hero, tracks, journey, "Meet the Scholars", apply form). |
| `/claire`, `/april` | Profile pages | Public scholar dashboards (Claire active BSN; April trial Grade 11). |
| `/janndilyne` | Profile page | Public TESDA scholar dashboard (unadvertised — not linked from homepage). |
| `/navigator/*` | `Navigator` | **Private** mentor ops dashboard. Cosmetic password lock. |
| `/entry` | Entry app | Scholar-facing data-entry portal. |
| `/home/:scholar` | `ScholarHome` | Scholar personal dashboard. |
| `/english/:scholar` | `EnglishTracking` | English / OET progress tracking. |
| `/grades/:scholar` | `GradeEntry` | GPA / grade entry. |

## Files

| File/Path | Role |
|---|---|
| `app/` | Next.js App Router — file-based routes, each a thin client wrapper. `app/layout.jsx` is the document shell; `app/[...legacy]/page.jsx` is the legacy-URL redirect catch-all; `app/navigator/[[...slug]]/page.jsx` drives Navigator's internal sections. |
| `src/entries/` | Route-level entry components (`navigator.jsx`, `claire.jsx`, `april.jsx`, `janndilyne.jsx`, `entry.jsx`), imported by `app/**/page.jsx`. |
| `src/entries/navigator.jsx` | Root `Navigator` component — manages data state, FX state, realtime subscriptions, renders the section matching its `slug` prop. |
| `src/screens/` | Full-page components (`HomePage`, `ScholarHome`, `EnglishTracking`, `GradeEntry`, `MilestonesTracker`, `VacationTracker`, `FAQPage`, `ScholarDocuments`). Named `screens/`, not `pages/`, to avoid colliding with Next's Pages Router auto-detection. |
| `src/components/` | Section-level components (alerts, status cards, nav bar, footer, AI panels, etc.). |
| `src/components/expenses/` | Expense sub-components (charts, filter panel, add form, workbench, sort/filter helpers). |
| `src/components/Profile/` | Scholar profile card components. |
| `src/context/FxContext.jsx` | FX rate context + `useFmt()` formatting hook + `useFxState()`. |
| `src/context/DataContext.jsx` | Data context (`DataCtx`) holding the live merged NGS_DATA snapshot. |
| `src/hooks/` | `useLocalStorage`, `useMediaQuery`, `useScholarProfile`. |
| `src/lib/supabase.js` | Supabase client singleton + `SUPABASE_URL` export. |
| `src/constants.js` | Shared UI constants (`EXPENSE_CATS`, `NAMECLASS`, `CAT_TO_BUCKET`). |
| `src/styles/` | CSS (token-based `--ngs-*` vars, Newsreader/Manrope/IBM Plex Mono, navy + gold). |
| `src/supabase-loader.js` | Fetches all operational data from Supabase in parallel. |
| `src/supabase-writer.js` | Fire-and-forget write-back to Supabase. |
| `src/utils.js` | Pure computation helpers (`scholarTotals`, `allExpenses`, `nextMilestone`, `accentFor`, etc.). |
| `src/fx.js` | FX rate helpers — market fetch, localStorage persistence. |
| `scholars-data.js` | Static fallback + narrative/profile/display copy + cosmetic lock password. |
| `supabase/` | SQL schema files + Deno Edge Functions (`ask`, `ask-scholar`, `ask-public`, `scholar-summary`, `drive-proxy`). |

### `neon-migration`-only files (not yet on `main`)

| File/Path | Role |
|---|---|
| `lib/db.js` | Lazy Neon serverless client (`@neondatabase/serverless`, HTTP mode) + `selectWhere()` helper. Lazy on purpose — Next's build-time page-data-collection step evaluates route modules, so an eager `neon(...)` call at module scope throws when `DATABASE_URL` isn't set at build time. |
| `lib/auth.js` | JWKS-verified JWT auth (`jose` + `createRemoteJWKSet`, cached) → role/`scholar_key` resolved from `public.user_profile` (never trusted from the token). `requireMentor`/`requireScholarOwn` helpers. |
| `lib/http.js` | `json()` + `withErrorHandling()` response helpers for API routes. |
| `app/api/bootstrap/route.js` | Replaces `supabase-loader.js`'s 10-way select; scoped by mentor/scholar role. |
| `app/api/changes/route.js` | Replaces the 9 Supabase realtime channels with polling (`?since=` → `{ now, tables }`). |
| `src/lib/auth-client.js` | Better Auth React client (`createAuthClient` + `jwtClient()` plugin) pointed at the Neon Auth base URL. `getToken()` reads the JWT off the `set-auth-jwt` response header — confirmed live against a real sign-in (see below). |
| `src/lib/api.js` | Fetch wrapper for the new API routes — Bearer token per request via `getToken()`, one 401-retry, `afterWrite()` poke hook for the future polling hook. |
| `app/sign-in/page.jsx`, `src/entries/sign-in.jsx` | **Temporary** Better Auth sign-up/sign-in/`getToken`/`/api/bootstrap` test harness at `/sign-in`. Not linked from app nav. Delete once Phase B4 lands real auth UI. |

## Data architecture

Three layers, merged at runtime:

- **`scholars-data.js`** — static fallback and narrative fields: scholar bio, English
  profile, public profile copy, program config (`lastUpdated`, `exchangeRate`), and
  the cosmetic lock password. Source of truth for hand-authored fields not held in
  the database.
- **Supabase (Postgres)** — operational data: expenses, GPA history, milestone and
  travel states, budgets, alerts, deadlines, action items, documents, English periods,
  career steps. Source of truth for anything the mentor edits week-to-week.
- **Frontend merge layer** — `supabase-loader.js` fetches all tables in parallel, then
  `Navigator` / `ScholarHome` merge the result with the static narrative fields from
  `scholars-data.js` and store it in React state (`const [D, setD] = useState(NGS_DATA)`).
  All sections read from this merged state via `DataCtx`. `Navigator` also subscribes to
  Supabase realtime so live edits re-render the dashboard.

When Supabase is unreachable, the app falls back to `scholars-data.js` as a static
snapshot (nav shows an offline indicator).

## navigator.jsx + DataContext

- The data snapshot is held in React state inside `Navigator` (not a mutable module
  variable), so Supabase updates trigger a full re-render of all sections.
- Components read the live snapshot via `useData()` from `DataContext`.
- `scholars-data.js` exports a named ES module export: `export const NGS_DATA = {...}`.
  Import it as `import { NGS_DATA } from '../../scholars-data.js'`.
- **Security note:** the `password` in `scholars-data.js` is **cosmetic only**. The file
  is a public static asset — anyone can read it. Do not treat this as real access control
  (see ROADMAP "Accepted risks").

## Neon migration status (branch `neon-migration`, PR #183, not merged to `main`)

Full plan: `/root/.claude/plans/linear-launching-dragonfly.md` (Phases A′, B0–B5, C, D).
Current state as of this checkpoint:

- **Phase A′ (Vite → Next.js App Router)** — ✅ done on this branch, verified on
  a live Vercel preview. `main` is **unaffected and still on Vite** — this PR
  is intentionally not merged yet (see PR #183).
- **Phase B0 (Neon provisioning + data migration)** — ✅ done. Neon project
  `patient-flower-81986836` ("NGS"); schema ported 1:1 from Supabase (19 tables +
  `updated_at`/touch-trigger on 7 polled tables + the `ngs_check_gpa_risk()`
  trigger, ported verbatim) plus a new `public.user_profile` table
  (`user_id → role, scholar_key`, since Better Auth's own `neon_auth.user` table
  has no field for it). All operational data migrated from Supabase
  (`rhoxpfuephkuaartuqou`) and row-count-verified per table (347 expenses, etc.).
- **Neon Auth is Better Auth**, not Stack Auth — an earlier plan assumption was
  corrected after inspecting the live `neon_auth.*` schema
  (`user`/`session`/`account`/`jwks`/…). `src/lib/auth-client.js` uses
  `better-auth/react` + the `jwtClient()` plugin.
- **Phase B1 (server skeleton + read path)** — ✅ done and **live-verified**:
  sign-up → sign-in → `getToken()` (JWT from the `set-auth-jwt` response header) →
  authenticated `GET /api/bootstrap` all confirmed working end-to-end via the
  `/sign-in` test harness, returning real migrated data (not empty arrays).
- **Phase B2 (write endpoints + mentor-side frontend port)** — ✅ done. All
  write routes under `app/api/**` (expenses, submissions incl. a transactional
  approve, actions, scholars, activity, English periods/sessions/forecasts/
  scenarios, grades, career, alerts — `documents`/`drive` were later removed,
  see Phase B5). `src/api-writer.js` +
  `src/api-loader.js` replace `supabase-writer.js`/`supabase-loader.js` with
  identical exported names/signatures. Every **mentor-only** call site
  (`navigator.jsx` and its section components) now reads/writes through Neon.
  `LockScreen.jsx` does a real Better Auth sign-in (was Supabase Auth).
- **Phase B3 (polling replaces realtime)** — ✅ done. `src/hooks/useChanges.js`
  is one shared module-level poller per tab against `/api/changes`, replacing
  every Supabase `postgres_changes` subscription on the mentor side. Live
  two-browser tested and confirmed working (~25s convergence).
- **Phase B5 (AI)** — ✅ done for the mentor side. Ported the Gemini tiered AI
  layer (`lib/ai/{context,tier1,tier2,tier3,action}.js`) to
  `app/api/{ask,ask-scholar,ask-public}/route.js`. `ask` is mentor-only
  (`requireMentor`); `ask-scholar`/`ask-public` stay unauthenticated by
  design, matching their pre-migration behavior (see "Known issues" below).
  Every mentor AI call site (`NavigatorAI`, `StatusSection`, `GcashCalculator`,
  `ExpenseWorkbench`, `NavigatorAIDrawer`, `PublicAskWidget`) now calls these
  instead of the Supabase Edge Functions — nothing in the mentor-facing app
  calls `supabase.auth.*` anymore, so `LockScreen`'s old dual-sign-in
  (Better Auth + a parallel Supabase Auth session) was removed.
  **Requires one new Vercel env var** to actually answer instead of 503ing
  "not configured": `GOOGLE_AI_KEY` — copy the same value already in Supabase
  secrets into the Vercel project's env vars (server-only, no
  `NEXT_PUBLIC_` prefix).
  **Documents/Google Drive storage was dropped entirely** on this branch
  (`DocumentsSection.jsx`, `app/api/documents/`, `app/api/drive/` all
  deleted) — the Google OAuth credential-management overhead (client secrets
  are view-once, 2-secret cap, refresh-token minting) wasn't worth it for
  this program's scale. The `documents` table in Neon and the Supabase-side
  scholar upload path (`ScholarDocuments.jsx`) were left untouched/unaffected.
- **Phase B4 (delete cosmetic auth gates everywhere)** — mentor gate landed as
  part of B2. Scholar-facing side: ✅ mostly done. All three scholars have
  real Neon Auth accounts (`user_profile.role='scholar'`) — Claire with her
  real email, April and Janndilyne with placeholder emails
  (`april@placeholder.nextgenscholars.dev` /
  `janndilyne@placeholder.nextgenscholars.dev`, swappable later since
  `user_profile` links by `user_id`, not email). `ScholarAuthGate.jsx` (real
  Better Auth sign-in, verified server-side via `GET /api/me`) now gates
  `ScholarHome`, `entry.jsx` (dropped its old scholar-picker — the account
  itself identifies the scholar), `GradeEntry`, `EnglishTracking`,
  `VacationTracker`, and `MilestonesTracker` — all migrated to read/write
  through Neon (`/api/bootstrap`, `/api/grades`, `/api/english/*`). Three of
  these (`GradeEntry`, `EnglishTracking`, `VacationTracker`,
  `MilestonesTracker`) had **no gate at all** before this — reachable
  directly by URL — so this closes a real pre-existing gap, not just a
  cosmetic-to-real swap. Along the way, fixed several call sites that were
  silently writing to (or reading stale data from) the now-orphaned Supabase
  tables since Phase B2: `EnglishIngestPanel.jsx` and
  `ScholarIngestPanel.jsx` (both shared with the mentor side) were inserting
  AI-extracted sessions/grades straight into Supabase, invisible to anyone;
  `ExpenseAskWidget.jsx` and `ScholarChatPanel.jsx` were querying the old
  Supabase `ask-scholar` Edge Function instead of the ported
  `/api/ask-scholar` route. All four now go through Neon.
  **Still on Supabase, deliberately untouched:** `ScholarLockGate.jsx` (kept
  as the fallback gate for any future non-migrated scholar),
  `useScholarProfile.js`, `ScholarDocuments.jsx` (`/docs/:scholar` —
  independent Drive upload path kept when the mentor-side Documents feature
  was dropped, see Phase B5 above), `HomePage.jsx`, and the public profile
  entries (`claire`/`april`/`janndilyne`) — these are public pages, not part
  of the scholar-auth surface, and were out of scope for this phase.
  **Numeric-string gotcha, hit twice:** Neon's serverless driver stringifies
  `NUMERIC`/`DECIMAL` columns (`gpa`, grade fields) to avoid precision loss,
  unlike Supabase's PostgREST which returned JSON numbers — coerce with
  `Number(...)` before any `.toFixed()`/arithmetic on these fields.
- Supabase remains the live backend for `main`/production throughout — nothing
  in this branch touches Supabase destructively (data was only read out, not
  deleted or modified there).

## AI layer

A tiered intelligence system behind the `/ask` family of Edge Functions. Tier 1 is a
deterministic, rule-based SQL resolver (no LLM, ~80% of queries); Tier 2 is Gemini
advisory; Tier 3 is Gemini 2.5 Flash ingestion (receipts, grade reports). See
`ROADMAP-AI.md` for full status. The AI layer is Gemini-only; the `GOOGLE_AI_KEY`
secret lives only in Supabase secrets — never in the client.

## Known issues / drift watch

- **`scholars-data.js` narrative drift** — it is the source of truth for narrative/profile
  fields. Profile pages merge Supabase operational data on top at runtime. Keep
  `publicProfile` blocks in sync with any Supabase-controlled fields (e.g. `currentSem`,
  GPA) referenced in the static copy.
- **`ask-scholar` is unauthenticated by design** (`verify_jwt = false`) and trusts a
  client-supplied `scholar` key. This is an accepted risk for the current phase; the
  planned fix is the PIN-gated scholar auth (ROADMAP-AI Step 21) + RLS hardening (Step 18).
  Do not store sensitive PII before that work lands.
- **Stale "Sheets" vocabulary** — some state/props/CSS still use `sheets*` naming left
  over from the pre-Supabase Google Sheets backend. Functional, but the names no longer
  reflect the backend.

## Working in this environment

- **Commits:** GPG signing fails here — commit with
  `git -c commit.gpgsign=false commit -m "..."`.
- **Push:** uses the owner's fine-grained PAT (Contents: write). The token is
  NOT stored in the repo — never commit secrets.
- **Edge Functions:** code changes under `supabase/functions/` only take effect after the
  owner runs `supabase functions deploy <name>` — they are not deployed from this repo.
- **GitHub Pages:** legacy build. After disruptive changes the Fastly CDN can lag.
  Confirm via the Pages API (`/repos/.../pages/builds/latest`) that the latest commit SHA
  is built.
- **Browser cache:** after a deploy, a normal reload often serves the old file.
  Tell the user to **hard-refresh** (Cmd/Ctrl+Shift+R).
- **Verifying behavior:** headless Chromium is available —
  `node` + `/opt/node22/lib/node_modules/playwright` (CommonJS `require`) +
  executablePath `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

### Working with Neon/Vercel (branch `neon-migration`)

- **Neon project:** `patient-flower-81986836` ("NGS"). **Supabase project**
  (source of truth for the migration copy): `rhoxpfuephkuaartuqou`.
- **Vercel project:** `next-gen-scholars` (team `jonncy18`) — separate from the
  owner's unrelated `next-gen-immersion` project; don't confuse the two.
  Framework Preset must be "Next.js" (it defaults to "Vite" on first import from
  a repo whose `main` is still Vite — check `mcp__Vercel__get_project` if a
  deploy fails with "No Output Directory named 'dist' found").
- **Vercel Deployment Protection** ("Vercel Authentication") must be disabled
  for headless/automated testing of preview deployments — otherwise API routes
  302-redirect to `vercel.com/sso-api` even via `web_fetch_vercel_url`. Only one
  protection level exists on the free tier (no scoped bypass token available).
- **Connection strings are never fetched into the transcript** — Claude Code's
  safety classifier blocks `mcp__Neon__get_connection_string`. Guide the human
  to copy it manually from the Neon console into Vercel's env var UI instead.
- **`mcp__Neon__run_sql` is one-statement-per-call** (Postgres extended query
  protocol restriction) — DDL/DML with multiple `;`-separated statements, or
  dollar-quoted function bodies via `prepare_database_migration`, must be split
  into individual calls.
- **The sandbox cannot reach the Neon Auth domain directly** (network policy) —
  Better Auth sign-in/JWT flows must be tested live in the human's own browser
  via the `/sign-in` test harness, not headlessly.
- Data-migration reads from Supabase are `SELECT`-only — nothing in this
  migration deletes/modifies Supabase data; it remains the live production
  backend until the Phase C cutover (see "Neon migration status" above).

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
