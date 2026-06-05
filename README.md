# NextGen Scholars

Private mentorship-program website and mentor dashboard for a privately funded
program supporting Filipino nursing students (NGN track) on a pathway toward
licensure abroad (PH → OET → NCLEX → AHPRA Australia).

- **Repo:** `jonncy18-maker/NextGen-Scholars`
- **Live:** https://jonncy18-maker.github.io/NextGen-Scholars/ (GitHub Pages, `main`)
- **Stack:** Vite + React 18, Google Sheets for live operational data

## Project overview

Four HTML pages served as a Vite multi-page app:

| Page | Role |
|---|---|
| `index.html` | Public homepage — hero, scholar cards, pathway, apply form |
| `claire.html` | Public scholar profile — Claire |
| `april.html` | Public scholar profile — April |
| `navigator.html` | Private mentor ops dashboard (cosmetic password lock, not real auth) |

Page sources live under `src/`. The navigator is the primary feature surface:

| Path | Role |
|---|---|
| `src/navigator.jsx` | Root `Navigator` component; manages data state and composes sections |
| `src/components/` | Section-level components: alerts, status cards, expenses, deadlines, actions, English pulse, nav, footer |
| `src/components/expenses/` | Expense sub-components: charts, filter panel, add-expense form, filter helpers |
| `src/context/` | React contexts: `DataContext` (live data snapshot) and `FxContext` (currency rate) |
| `src/styles/` | CSS — token-based `--ngs-*` vars, navy + gold palette, Newsreader/Manrope fonts |
| `src/sheets-loader.js` | Fetches live operational data from Google Sheets |
| `src/sheets-writer.js` | Fire-and-forget writes back to Sheets via Apps Script |
| `src/utils.js` | Scholar computation helpers (`scholarTotals`, `nextMilestone`, etc.) |
| `src/fx.js` | FX rate utilities — market fetch + localStorage persistence |
| `src/constants.js` | Shared UI constants (`EXPENSE_CATS`, `NAMECLASS`) |
| `scholars-data.js` | Static fallback data + narrative copy + program config |

## Data architecture

Two tiers of data, merged at runtime by `sheets-loader.js`:

- **`scholars-data.js`** — static fallback and narrative fields: scholar bio,
  English profile observations, public profile copy, program config, cosmetic lock
  password. Used as fallback when Sheets is unavailable, and as the source for
  fields not held in Sheets (e.g. `english`, `publicProfile`).
- **Google Sheets** — operational data: expenses, GPA history, milestone and
  travel states, budgets, alerts, deadlines, action items.
- **Frontend merge layer** (`sheets-loader.js` + `Navigator`) — fetches Sheets
  data, merges it with static narrative fields, then stores the result in React
  state. All components read from this merged state via `DataContext`.

## Development

```bash
npm install
npm run dev      # Vite dev server — http://localhost:5173/
npm run build    # Production build → dist/
npm run preview  # Preview the build locally
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
- See `ROADMAP.md` for the tech-debt backlog and architecture decisions.
