# NextGen Scholars — Project Context

Private mentorship-program website + mentor dashboard for a privately funded
program supporting Filipino nursing students (NGN track) on a pathway toward
licensure abroad (PH → OET → NCLEX → AHPRA Australia).

- **Repo:** `jonncy18-maker/NextGen-Scholars` (renamed from `NexGen`)
- **Live:** https://jonncy18-maker.github.io/NextGen-Scholars/ (GitHub Pages, `main`)

## Build system

The repo uses **Vite + React 18 + JSX** under `src/`. All four HTML pages are
Vite entry points (`index.html`, `claire.html`, `april.html`, `navigator.html`).
The root HTML files and `src/` are what Vite builds and GitHub Pages serves.
`project/` and `chats/` have been removed — `src/` is the single canonical source tree.

## Files

| File/Path | Role |
|---|---|
| `index.html` | Public homepage (hero, tracks, journey, "Meet the Scholars", apply form). |
| `claire.html` | Public scholar dashboard — Claire (active BSN). |
| `april.html` | Public scholar dashboard — April (trial period, Grade 11). |
| `navigator.html` | **Private** mentor ops dashboard. Cosmetic password lock. |
| `src/navigator.jsx` | Root `Navigator` component — manages data state, FX state, and renders all sections. |
| `src/components/` | Section-level components (alerts, status cards, nav bar, footer, etc.). |
| `src/components/expenses/` | Expense sub-components (charts, filter panel, add form, sort/filter helpers). |
| `src/context/FxContext.jsx` | FX rate context + `useFmt()` formatting hook. |
| `src/context/DataContext.jsx` | Data context (`DataCtx`) holding the live merged NGS_DATA snapshot. |
| `src/constants.js` | Shared UI constants (`EXPENSE_CATS`, `NAMECLASS`). |
| `src/styles/` | CSS (token-based `--ngs-*` vars, Newsreader/Manrope/IBM Plex Mono, navy + gold). |
| `src/sheets-loader.js` | Fetches all operational data from Google Sheets. |
| `src/sheets-writer.js` | Fire-and-forget write-back to Sheets via Apps Script. |
| `src/utils.js` | Pure computation helpers (`scholarTotals`, `nextMilestone`, `accentFor`, etc.). |
| `src/fx.js` | FX rate helpers — market fetch, localStorage persistence. |
| `scholars-data.js` | Static fallback + narrative/profile/display copy + cosmetic lock password. |

## Data architecture

Three layers, merged at runtime:

- **`scholars-data.js`** — static fallback and narrative fields: scholar bio, English
  profile, public profile copy, program config (`lastUpdated`, `exchangeRate`), and
  the cosmetic lock password. This file is the source of truth for fields that are
  hand-authored and not held in Sheets.
- **Google Sheets** — operational data: expenses, GPA history, milestone and travel
  states, budgets, alerts, deadlines, action items. Sheets is the source of truth for
  anything the mentor edits week-to-week.
- **Frontend merge layer** — `sheets-loader.js` fetches all Sheets tabs in parallel,
  then `Navigator` merges the result with the static narrative fields from
  `scholars-data.js` and stores it in React state (`const [D, setD] = useState(NGS_DATA)`).
  All sections read from this merged state via `DataCtx`.

When Sheets is unreachable, the app falls back to `scholars-data.js` as a static
snapshot (nav shows "Sheets · offline").

## navigator.jsx + DataContext

- The data snapshot is held in React state inside `Navigator` (not a mutable module
  variable), so Sheets updates trigger a full re-render of all sections.
- Components read the live snapshot via `useData()` from `DataContext`.
- `scholars-data.js` exports a named ES module export: `export const NGS_DATA = {...}`.
  Import it as `import { NGS_DATA } from '../scholars-data.js'`.
- **Security note:** the `password` in `scholars-data.js` is **cosmetic only**. The file
  is a public static asset — anyone can read it. Do not treat this as real access control
  (see ROADMAP #1).

## Data drift watch

`scholars-data.js` is the source of truth for narrative/profile fields. The profile
pages (`claire.jsx`, `april.jsx`) merge Sheets operational data on top at runtime.
Keep `publicProfile` blocks in `scholars-data.js` in sync with any Sheets-controlled
fields (e.g. `currentSem`, GPA) that are also referenced in the static copy.

## Working in this environment

- **Commits:** GPG signing fails here — commit with
  `git -c commit.gpgsign=false commit -m "..."`.
- **Push:** uses the owner's fine-grained PAT (Contents: write). The token is
  NOT stored in the repo — never commit secrets. `git push origin <branch>`.
- **GitHub Pages:** legacy build. After disruptive changes the Fastly CDN can
  lag. Builds usually finish in seconds; confirm via the Pages API
  (`/repos/.../pages/builds/latest`) that the latest commit SHA is built.
- **Browser cache:** after a deploy, a normal reload often serves the old file.
  Tell the user to **hard-refresh** (Cmd/Ctrl+Shift+R).
- **Verifying behavior:** there's a headless Chromium available for real
  browser testing —
  `node` + `/opt/node22/lib/node_modules/playwright` (CommonJS `require`) +
  executablePath `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

## Conventions

- Match the existing inline style of each file (token-based CSS vars `--ngs-*`,
  Newsreader/Manrope/IBM Plex Mono fonts, navy + gold palette).
- Keep internal links relative (`index.html`, `claire.html`, `index.html#scholars`).
- Only commit/push when asked. Use `git -c commit.gpgsign=false`.
