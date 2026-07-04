# NextGen Scholars

Private mentorship-program website and mentor dashboard for a privately funded
program supporting Filipino nursing students (NGN track) on a pathway toward
licensure abroad (PH → OET → NCLEX → AHPRA Australia).

- **Repo:** `jonncy18-maker/NextGen-Scholars`
- **Live:** https://jonncy18-maker.github.io/NextGen-Scholars/ (GitHub Pages, `main` —
  still Vite + Supabase; see below)
- **This branch (`neon-migration`):** Next.js 14 (App Router) + React 18, migrating
  the backend from Supabase to Neon (Postgres) + Neon Auth (Better Auth), hosted on
  Vercel. Not yet merged to `main` — see `CLAUDE.md` for full migration status and
  `/root/.claude/plans/linear-launching-dragonfly.md` for the phased plan.

## Project overview

A Next.js **App Router** app. `app/**/page.jsx` route files are thin `'use client'`
wrappers (via `next/dynamic`, `ssr:false`, since the app is fully browser-API-dependent)
around the pre-existing screen/component code under `src/`. `app/[...legacy]/page.jsx`
reproduces the old GitHub Pages legacy-URL redirect behavior client-side. (Previously a
single Vite SPA with hash-based routing (`HashRouter`) and a `404.html` redirect for
GitHub Pages deep-link compatibility — see git history on `main`.)

### Routes

| Route | Component | Role |
|---|---|---|
| `/` | `HomePage` | Public homepage — hero, scholar cards, pathway, apply form |
| `/claire` | `ClairePage` | Public scholar profile — Claire |
| `/april` | `AprilPage` | Public scholar profile — April |
| `/navigator/*` | `Navigator` | Private mentor ops dashboard (cosmetic password lock) |
| `/entry` | `EntryApp` | Scholar-facing data entry portal |
| `/home/:scholar` | `ScholarHome` | Scholar personal dashboard |
| `/english/:scholar` | `EnglishTracking` | English progress tracking for a scholar |
| `/grades/:scholar` | `GradeEntry` | GPA / grade entry for a scholar |

Legacy multi-page URLs (`claire.html`, `navigator.html`, etc.) are redirected
to their SPA equivalents at runtime.

## Source layout

```
app/                         # Next.js App Router — file-based routes, thin client wrappers.
  layout.jsx                  # Document shell — global CSS, ErrorBoundary
  [...legacy]/page.jsx        # Legacy-URL redirect catch-all (old .html paths, ?scholar= forms)
  navigator/[[...slug]]/page.jsx  # Drives Navigator's internal sections
  api/                         # neon-migration only — Next.js API route handlers (see below)
src/
  entries/                    # Route-level entry components (navigator, claire, april, janndilyne, entry)
  screens/                    # Full-page components (HomePage, ScholarHome, EnglishTracking, GradeEntry, …)
                               # Named screens/, not pages/ — avoids colliding with Next's Pages Router auto-detection
  components/                 # Section-level components
    expenses/                 # Expense sub-components (charts, filter, add form, workbench)
    Profile/                  # Scholar profile card components
    AlertsSection, BudgetSection, CareerSection, DeadlinesSection,
    EnglishSection, GradesSection, RiskSection,
    StatusSection, TravelModule, ActivityFeed, EnglishIngestPanel,
    ScholarIngestPanel, NavigatorAI, NavigatorAIDrawer,
    ScholarAIPanel, ScholarChatPanel, MentorHome, LockScreen, ...
  context/
    DataContext.jsx            # Live merged data snapshot via useData()
    FxContext.jsx              # Currency rate context + useFmt() hook
  hooks/
    useLocalStorage.js
    useMediaQuery.js
    useScholarProfile.js
  lib/
    supabase.js                # Supabase client singleton (still the live backend on `main`)
    auth-client.js              # neon-migration only — Better Auth React client
    api.js                      # neon-migration only — fetch wrapper for the new API routes
  styles/                     # CSS — token-based --ngs-* vars, navy + gold palette
  supabase-loader.js          # Fetches all operational data from Supabase
  supabase-writer.js          # Fire-and-forget writes back to Supabase
  utils.js                    # Scholar computation helpers (scholarTotals, nextMilestone, …)
  fx.js                       # FX rate utilities — market fetch + localStorage persistence
  constants.js                # Shared UI constants (EXPENSE_CATS, NAMECLASS)

lib/                          # neon-migration only — server-side libs for app/api/*
  db.js                        # Lazy Neon serverless client + selectWhere() helper
  auth.js                      # JWKS JWT verification, role/scholar_key resolution
  http.js                      # json() / withErrorHandling() response helpers

scholars-data.js              # Static fallback data, narrative copy, program config
supabase/                     # SQL schema files and Supabase function definitions
```

See `CLAUDE.md` for the full file table and the current Neon migration status.

## Data architecture

Three layers, merged at runtime:

- **`scholars-data.js`** — static narrative fields: scholar bio, English profile
  observations, public profile copy, program config, cosmetic lock password.
  Source of truth for hand-authored fields not held in the database.
- **Supabase (Postgres)** — operational data: expenses, GPA history, milestone
  and travel states, budgets, alerts, deadlines, action items, documents, English
  periods, career steps.
- **Frontend merge layer** — `supabase-loader.js` fetches Supabase tables in
  parallel, `Navigator` / `ScholarHome` merge the result with static fields, and
  store everything in React state. All sections read from this via `DataContext`.

When Supabase is unreachable, the app falls back to `scholars-data.js` as a
static snapshot (nav shows an offline indicator).

## Development

```bash
npm install
npm run dev      # Next dev server — http://localhost:3000/
npm run build    # Production build (next build)
npm run start    # Serve the production build locally
npm run format   # Prettier — formats src/**/*.{js,jsx,css}, app/**/*.jsx, and scholars-data.js
```

Env vars are `NEXT_PUBLIC_*` (not Vite's `VITE_*`) — see `.env.example`. This
branch also needs a server-only `DATABASE_URL` (Neon connection string) for the
`app/api/*` routes — never committed, set in `.env.local` / Vercel project env vars.

## Notes for contributors

- **Commits:** GPG signing may fail in some environments — use
  `git -c commit.gpgsign=false commit`.
- **Push:** uses a fine-grained PAT (Contents: write). Never commit secrets.
- **Hard-refresh after deploy:** Fastly CDN can cache; use Ctrl/Cmd+Shift+R.
- **Headless browser testing:** Chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` via
  `/opt/node22/lib/node_modules/playwright` (CommonJS `require`).
- See `CLAUDE.md` for full project context, conventions, and known issues.
- See `ROADMAP.md` and `ROADMAP-AI.md` for the tech-debt and AI feature backlogs.
