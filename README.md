# NextGen Scholars

Private mentorship-program website and mentor dashboard for a privately funded
program supporting Filipino nursing students (NGN track) on a pathway toward
licensure abroad (PH → OET → NCLEX → AHPRA Australia).

- **Repo:** `jonncy18-maker/NextGen-Scholars`
- **Live:** https://next-gen-scholars-jonncy18.vercel.app (Vercel, `main`).
  The old GitHub Pages URL is now a frozen redirect stub (`gh-pages-redirect/`)
  forwarding old bookmarks/hash routes to the Vercel domain.
- **Stack:** Next.js 14 (App Router) + React 18, backed by Neon (serverless
  Postgres) + Neon Auth (Better Auth) + Next.js API routes, deployed on
  Vercel. Cut over from Vite/HashRouter/Supabase on 2026-07-04 (PR #183);
  full migration history in `ROADMAP.md` → "Phase 5".

## Project overview

A Next.js **App Router** app. `app/**/page.jsx` route files are thin `'use
client'` wrappers (via `next/dynamic`, `ssr:false`) around the pre-existing
screen/component code under `src/`. `app/[...legacy]/page.jsx` reproduces the
old multi-page/hash-route redirect behavior client-side for any bookmarked
legacy URL.

### Routes

| Route | Component | Role |
|---|---|---|
| `/` | `HomePage` | Public homepage — hero, tracks, journey, "Meet the Scholars", apply form |
| `/login` | `LoginPage` | Generic sign-in — no person is picked up front. Signs in, then routes to the caller's own dashboard based on server-resolved role. |
| `/claire`, `/april` | Profile pages | Public scholar dashboards (Claire active BSN; April trial Grade 11) |
| `/janndilyne` | Profile page | Public TESDA scholar dashboard (unadvertised — not linked from homepage) |
| `/navigator/*` | `Navigator` | Private mentor ops dashboard — real Better Auth sign-in |
| `/entry` | `EntryApp` | Scholar-facing expense-entry portal — real Better Auth sign-in |
| `/home/:scholar` | `ScholarHome` | Scholar personal dashboard — real Better Auth sign-in |
| `/english/:scholar` | `EnglishTracking` | English / OET progress tracking |
| `/grades/:scholar` | `GradeEntry` | GPA / grade entry |
| `/vacation/:scholar` | `VacationTracker` | Reward-trip tracker |
| `/milestones/:scholar` | `MilestonesTracker` | Reward-milestone tracker |

Legacy multi-page URLs (`claire.html`, `navigator.html`, `?scholar=` forms,
etc.) are redirected to their current equivalents at runtime.

## Source layout

```
app/                         # Next.js App Router — file-based routes, thin client wrappers.
  layout.jsx                  # Document shell — global CSS, ErrorBoundary
  [...legacy]/page.jsx        # Legacy-URL redirect catch-all
  navigator/[[...slug]]/page.jsx  # Drives Navigator's internal sections
  login/page.jsx               # Generic sign-in
  api/                         # Next.js API route handlers — see lib/ below
src/
  entries/                    # Route-level entry components (navigator, login, claire, april, janndilyne, entry)
  screens/                    # Full-page components (HomePage, ScholarHome, EnglishTracking, GradeEntry, VacationTracker, MilestonesTracker, FAQPage)
                               # Named screens/, not pages/ — avoids colliding with Next's Pages Router auto-detection
  components/                 # Section-level components
    expenses/                 # Expense sub-components (charts, filter, add form, workbench)
    Profile/                  # Scholar profile card components
    AlertsSection, BudgetSection, CareerSection, DeadlinesSection,
    EnglishSection, GradesSection, RiskSection,
    StatusSection, TravelModule, ActivityFeed, EnglishIngestPanel,
    ScholarIngestPanel, NavigatorAI, NavigatorAIDrawer,
    ScholarAIPanel, ScholarChatPanel, PublicAskWidget, SignOutButton,
    MentorHome, LockScreen, ScholarAuthGate, NavBar, NavFooter, ...
  context/
    DataContext.jsx            # Live merged data snapshot via useData()
    FxContext.jsx              # Currency rate context + useFmt() hook
  hooks/
    useLocalStorage.js
    useMediaQuery.js
    useScholarProfile.js
    useChanges.js               # Polls /api/changes so live edits re-render the dashboard
  lib/
    auth-client.js              # Better Auth React client (createAuthClient + jwtClient())
    api.js                       # Fetch wrapper for app/api/** — Bearer token per request
  styles/                     # CSS — token-based --ngs-* vars, navy + gold palette
  api-loader.js               # Neon-backed data loader (loadFromSupabase() — name kept for call-site parity)
  api-writer.js                # Neon-backed data writer, one function per operation
  utils.js                    # Scholar computation helpers (scholarTotals, nextMilestone, …)
  fx.js                       # FX rate utilities — market fetch + localStorage persistence
  constants.js                # Shared UI constants (EXPENSE_CATS, NAMECLASS)

lib/                          # Server-side libs for app/api/*
  db.js                        # Lazy Neon serverless client + selectWhere() helper
  auth.js                      # JWKS JWT verification, role/scholar_key resolution
  http.js                      # json() / withErrorHandling() response helpers
  ai/                           # Gemini tiered AI layer (context, tier1, tier2, tier3, action)

scholars-data.js              # Static fallback data, narrative copy, program config
db/                            # Reference SQL schema (not applied automatically — see db/README.md)
gh-pages-redirect/             # Frozen GitHub Pages redirect stub, forwards old bookmarks to Vercel
```

See `CLAUDE.md` for the full file table and current architecture notes.

## Data architecture

Three layers, merged at runtime:

- **`scholars-data.js`** — static narrative fields: scholar bio, English
  profile observations, public profile copy, program config, cosmetic lock
  password. Source of truth for hand-authored fields not held in the
  database.
- **Neon (Postgres)** — operational data: expenses, GPA history, milestone
  and travel states, budgets, alerts, deadlines, action items, English
  periods, career steps.
- **Frontend merge layer** — `src/api-loader.js` fetches `/api/bootstrap` in
  one call, `Navigator` / `ScholarHome` merge the result with static fields,
  and store everything in React state. All sections read from this via
  `DataContext`. `useChanges.js` polls `/api/changes` (~25s) so live edits
  re-render the dashboard.

When Neon is unreachable, the app falls back to `scholars-data.js` as a
static snapshot (nav shows an offline indicator).

## Development

```bash
npm install
npm run dev      # Next dev server — http://localhost:3000/
npm run build    # Production build (next build)
npm run start    # Serve the production build locally
npm run format   # Prettier — formats src/**/*.{js,jsx,css}, app/**/*.jsx, and scholars-data.js
```

Env vars are `NEXT_PUBLIC_*` (not Vite's `VITE_*`) — see `.env.example`. A
server-only `DATABASE_URL` (Neon connection string) and `GOOGLE_AI_KEY`
(Gemini) are required for `app/api/*` routes — never committed, set in
`.env.local` / Vercel project env vars only.

## Notes for contributors

- **Commits:** GPG signing may fail in some environments — use
  `git -c commit.gpgsign=false commit`.
- **Push:** uses a fine-grained PAT (Contents: write). Never commit secrets.
- **Hard-refresh after deploy:** browsers/CDNs can cache; use Ctrl/Cmd+Shift+R.
- **Headless browser testing:** Chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` via
  `/opt/node22/lib/node_modules/playwright` (CommonJS `require`).
- See `CLAUDE.md` for full project context, conventions, and known issues.
- See `ROADMAP.md` and `ROADMAP-AI.md` for the tech-debt and AI feature backlogs.
