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
  Vercel. Cut over from Vite/HashRouter/Supabase on **2026-07-04** (PR #183);
  Supabase decommission (Phase D) completed the same week — no code in this
  repo depends on Supabase anymore. Full migration history:
  `ROADMAP.md` → "Phase 5 — Migration: Supabase → Neon + Vercel".

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

## API Key / Security Rules

| Key | Prefix | Lives | Why |
|---|---|---|---|
| `DATABASE_URL` | none | Server only (`lib/db.js`) | Neon connection string — full DB access if leaked. |
| `GOOGLE_AI_KEY` | none | Server only (`lib/ai/*`, `app/api/{ask,ask-scholar,ask-public}/*`) | Gemini API key — quota abuse risk if exposed client-side. |

**Rule:** anything that touches the Neon database directly or calls Gemini
runs only in `app/api/**` route handlers; the browser calls those routes,
never Neon or Gemini directly. Never commit a value for either key — set both
in Vercel's project env vars only.

## Routes

| Route | Component | Role |
|---|---|---|
| `/` | `HomePage` | Public homepage (hero, tracks, journey, "Meet the Scholars", apply form). |
| `/login` | `LoginPage` (`src/entries/login.jsx`) | Generic sign-in for the nav "Login" button — no person/name is picked up front. Signs in, then `GET /api/me` (role + `scholarKey` resolved server-side) decides the destination: `/navigator` for mentors, `/home/:scholar` for scholars. Replaces the old `HomePage.jsx` "Who's signing in?" destination-picker modal. |
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
| `src/constants.js` | Shared UI constants (`EXPENSE_CATS`, `NAMECLASS`, `CAT_TO_BUCKET`). |
| `src/styles/` | CSS (token-based `--ngs-*` vars, Newsreader/Manrope/IBM Plex Mono, navy + gold). |
| `src/utils.js` | Pure computation helpers (`scholarTotals`, `allExpenses`, `nextMilestone`, `accentFor`, etc.). |
| `src/fx.js` | FX rate helpers — market fetch, localStorage persistence. |
| `scholars-data.js` | Static fallback + narrative/profile/display copy + cosmetic lock password. |
| `db/` | Reference SQL schema (moved from the old `supabase/` in Phase D) — not applied automatically by anything; see `db/README.md`. |
| `lib/db.js` | Lazy Neon serverless client (`@neondatabase/serverless`, HTTP mode) + `selectWhere()` helper. Lazy on purpose — Next's build-time page-data-collection step evaluates route modules, so an eager `neon(...)` call at module scope throws when `DATABASE_URL` isn't set at build time. |
| `lib/auth.js` | JWKS-verified JWT auth (`jose` + `createRemoteJWKSet`, cached) → role/`scholar_key` resolved from `public.user_profile` (never trusted from the token). `requireMentor`/`requireScholarOwn` helpers. |
| `lib/http.js` | `json()` + `withErrorHandling()` response helpers for API routes. |
| `lib/ai/{context,tier1,tier2,tier3,action}.js` | Gemini tiered AI layer (context builder, deterministic tier1 SQL resolver, tier2 advisory, tier3 ingestion, GCash action matching). |
| `src/api-loader.js`, `src/api-writer.js` | Neon-backed data loader/writer, one function per operation, imported by every mentor/scholar screen. |
| `app/api/bootstrap/route.js` | One-call data fetch scoped by mentor/scholar role (mentor unscoped, scholar filtered to own `scholar_key`). |
| `app/api/changes/route.js` | Polling endpoint (`?since=` → `{ now, tables }`) consumed by `src/hooks/useChanges.js`. |
| `app/api/config/route.js` | GET/PUT for the `config` table (mentor-only) — currently backs `ProgramDetailsSection.jsx`'s program-details editor, whose text `app/api/ask-public/route.js` reads for the public AI chat's context. |
| `app/api/public/profile/[key]/route.js` | Public, unauthenticated curated whitelist backing the public profile pages — see "Public-profile dataset leak" below. |
| `app/api/me/route.js` | Returns `{ role, scholarKey }` for the caller's own token — used by `ScholarAuthGate.jsx` (scholar pages) and `navigator.jsx` (mentor gate) to verify a session actually matches the expected role/scholar before trusting it. |
| `app/api/{ask,ask-scholar,ask-public}/route.js` | Gemini AI orchestrators. `ask` is mentor-only; `ask-scholar`/`ask-public` unauthenticated by design (see "Key Rules for Claude Code"). |
| `src/components/ScholarAuthGate.jsx` | Real Better Auth sign-in gate for all three scholar-facing pages (Claire, April, Janndilyne). |
| `src/lib/auth-client.js` | Better Auth React client (`createAuthClient` + `jwtClient()` plugin) pointed at the Neon Auth base URL. `getToken()` reads the JWT off the `set-auth-jwt` response header. |
| `src/lib/api.js` | Fetch wrapper for `app/api/**` — Bearer token per request via `getToken()`, one 401-retry, `afterWrite()` poke hook consumed by `useChanges.js`. |
| `app/sign-in/page.jsx`, `src/entries/sign-in.jsx` | **Temporary** Better Auth test harness at `/sign-in`, not linked from app nav. Was used to live-verify the auth flow during migration; cleanup candidate. |
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
  (Supabase held this data pre-cutover; see `ROADMAP.md` → "Phase 5" for the
  migration history. The
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

## AI layer

A tiered intelligence system behind the `/api/ask*` routes (`lib/ai/{context,tier1,
tier2,tier3,action}.js`, ported verbatim from the original Supabase Edge Functions).
Tier 1 is a deterministic, rule-based SQL resolver (no LLM, ~80% of queries); Tier 2
is Gemini advisory; Tier 3 is Gemini 2.5 Flash ingestion (receipts, grade reports).
See `ROADMAP-AI.md` for full status. The AI layer is Gemini-only; the `GOOGLE_AI_KEY`
secret lives only in Vercel's project env vars — never in the client.

## Key Rules for Claude Code

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
- **Stale pre-migration docs** — `README.md`, `ROADMAP.md`, `ROADMAP-AI.md`, and
  `docs/SPA-MIGRATION-ROADMAP.md` still describe the Supabase-era architecture
  in places (historical changelogs, diagrams). Not code, no functional impact
  — a documentation-refresh pass is a nice-to-have, not urgent.
- **Neon Auth `trusted_origins` must list every production alias.** Vercel
  generates multiple hostnames for one production deployment (e.g. the
  `jonncy18` domain, a random `-steel`-style alias, and the `git-main-jonncy18`
  branch alias) — Better Auth rejects sign-in from any origin not on the
  allowlist, and `LockScreen.jsx`/`ScholarAuthGate.jsx` show a generic
  "Incorrect credentials" for that rejection, indistinguishable from a real
  wrong password. If login fails on a URL that otherwise resolves to the
  correct production deployment, check `mcp__Neon__get_neon_auth_config`'s
  `trusted_origins` before assuming the password is wrong; add the missing
  origin with `mcp__Neon__configure_neon_auth` (`add_trusted_origin`) — takes
  effect immediately, no redeploy needed. Hit and fixed 2026-07-04 for the
  `-steel` and `git-main-jonncy18` aliases (and again for a PR preview alias
  while debugging the bug below — preview URLs need this too, not just the
  three long-lived production aliases).
- **Every scholar screen's data-fetch effect must gate on `authed`, not just
  the render.** `EnglishTracking`, `GradeEntry`, `VacationTracker`, and
  `MilestonesTracker` all do `if (!authed) return; ...` inside their data
  effects (with `authed` in the deps array) — `ScholarHome` was missing this
  and it caused a real bug (2026-07-04, PR #187, six iterations to root-cause):
  React fires effects on mount regardless of what the component *renders*, so
  a fetch effect gated only by `if (!authed) return <ScholarAuthGate/>` in the
  JSX still runs immediately, using whatever session cookie the browser
  already has — i.e. the *previous* scholar's, if the user navigated straight
  from one scholar's dashboard to another's login without signing out. That
  fetch's (wrong) response gets cached in state; signing in then unlocks the
  dashboard onto the stale data, and nothing re-fetches since `authed`
  wasn't a dependency. Symptom: a scholar's dashboard shows a *different*
  scholar's numbers until a manual refresh. The tell in DevTools is the
  `bootstrap` request firing *before* the sign-in's own request. Any new
  scholar-facing screen needs this same guard.
- **API responses must set their own `Cache-Control`.** Found alongside the
  bug above (a real issue, though not this bug's actual cause): Next.js App
  Router route handlers default to a *shareable* `Cache-Control: public,
  max-age=0, must-revalidate` with no `Vary: Authorization` when a response
  doesn't set its own cache header — verified live via
  `mcp__Vercel__web_fetch_vercel_url`. `lib/http.js`'s `json()` now sends
  `Cache-Control: private, no-store` on every response for this reason; keep
  using `json()` for all `app/api/**` responses rather than a raw
  `new Response(...)` so this stays covered.

## Working in this environment

- **Commits:** GPG signing fails here — commit with
  `git -c commit.gpgsign=false commit -m "..."`.
- **Push:** uses the owner's fine-grained PAT (Contents: write). The token is
  NOT stored in the repo — never commit secrets.
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
  database. The Supabase project (`rhoxpfuephkuaartuqou`) is fully
  decommissioned (Phase D) and was **paused on 2026-07-04** — nothing in this
  repo reads or writes to it anymore. Data is retained and the project is
  restorable from the Supabase dashboard if ever needed.
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

Protocol: https://raw.githubusercontent.com/jonncy18-maker/agentic-loop/main/AGENTIC_LOOP.md
(read in full at the start of each session; orchestrator: `orchestrator.js` in the same repo).
Activate for any change touching 3+ files, a new component/module, the data
layer, or with user-visible behavior, or estimated at more than ~5 minutes of
work — otherwise (typo, one-liner, single-file config change) just do it directly.

## Wide-screen layout

`ScholarHome` (`src/styles/scholar-home.css`) and the expense-entry page
(`src/styles/entry.css`) switch to a two-column CSS grid layout at
`min-width: 1200px` (`grid-template-areas`, no JSX changes needed) — below
that they're the original single centered column. On `ScholarHome` the AI
chat panel becomes a sticky right rail next to the action cards/trackers; on
the entry page, chat/form/receipt-upload sit in a left rail next to the
pending-review list and expense table. The breakpoint was originally 1440px
but was lowered to 1200px (PR #186) since 1440px didn't reliably trigger on
real laptop displays once OS display scaling / browser zoom reduces the
effective CSS viewport width below the physical resolution.

## Conventions

- Match the existing inline style of each file (token-based CSS vars `--ngs-*`,
  Newsreader/Manrope/IBM Plex Mono fonts, navy + gold palette).
- Keep internal navigation within the app using Next.js `<Link>` (`next/link`)
  and `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`) — not
  `react-router-dom`, which was removed in the Phase A′ migration.
- Only commit/push when asked. Use `git -c commit.gpgsign=false`.
