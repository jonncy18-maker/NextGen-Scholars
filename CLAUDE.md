# NextGen Scholars — Project Context

Private mentorship-program website + mentor dashboard for a privately funded
program supporting Filipino nursing students (NGN track) on a pathway toward
licensure abroad (PH → OET → NCLEX → AHPRA Australia).

- **Repo:** `jonncy18-maker/NextGen-Scholars` (renamed from `NexGen`)
- **Live:** https://jonncy18-maker.github.io/NextGen-Scholars/ (GitHub Pages, `main`) —
  **migrating to Vercel**; see `neon-migration` branch and the migration plan.
- **Stack:** Next.js 14 (App Router) + React 18 · Supabase (Postgres + Edge Functions),
  **migrating to Neon + Neon Auth**. (Previously Vite + React Router v6/HashRouter —
  see git history for the pre-migration architecture.)

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
- Keep internal navigation within the SPA (React Router `<Link>` / routes).
- Only commit/push when asked. Use `git -c commit.gpgsign=false`.
