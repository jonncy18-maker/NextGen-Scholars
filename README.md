# NextGen Scholars

Private mentorship-program website and mentor dashboard for a privately funded
program supporting Filipino nursing students (NGN track) on a pathway toward
licensure abroad (PH → OET → NCLEX → AHPRA Australia).

- **Repo:** `jonncy18-maker/NextGen-Scholars`
- **Live:** https://jonncy18-maker.github.io/NextGen-Scholars/ (GitHub Pages, `main`)
- **Stack:** Vite + React 18 + React Router v6, Supabase (Postgres) for live operational data

## Project overview

A single React app with hash-based routing (`HashRouter`), served from `index.html`.
A `404.html` redirect handles GitHub Pages deep-link compatibility.

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
src/
  App.jsx                     # Root — HashRouter, routes, top-level ErrorBoundary
  entries/                    # Vite entry components (claire, april, navigator, entry, main)
  pages/                      # Full-page React components (HomePage, ScholarHome, EnglishTracking, GradeEntry)
  components/                 # Section-level components
    expenses/                 # Expense sub-components (charts, filter, add form, workbench)
    Profile/                  # Scholar profile card components
    AlertsSection, BudgetSection, CareerSection, DeadlinesSection,
    DocumentsSection, EnglishSection, GradesSection, RiskSection,
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
    supabase.js               # Supabase client singleton
  styles/                     # CSS — token-based --ngs-* vars, navy + gold palette
  supabase-loader.js          # Fetches all operational data from Supabase
  supabase-writer.js          # Fire-and-forget writes back to Supabase
  utils.js                    # Scholar computation helpers (scholarTotals, nextMilestone, …)
  fx.js                       # FX rate utilities — market fetch + localStorage persistence
  constants.js                # Shared UI constants (EXPENSE_CATS, NAMECLASS)

scholars-data.js              # Static fallback data, narrative copy, program config
supabase/                     # SQL schema files and Supabase function definitions
```

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
npm run dev      # Vite dev server — http://localhost:5173/NextGen-Scholars/
npm run build    # Production build → dist/
npm run preview  # Preview the build locally
npm run format   # Prettier — formats src/**/*.{js,jsx,css} and scholars-data.js
```

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
