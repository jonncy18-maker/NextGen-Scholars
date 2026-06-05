# NextGen Scholars — Roadmap / Tech Debt

Captured from architecture reviews (Codex) + situated prioritization for this
project's actual context. This file is now a status-tracked backlog.

## Status summary

| Area | Status | Notes |
|---|---|---|
| Public navigator data exposure | Accepted risk for now | The navigator password is cosmetic, but the owner confirmed the exposed data is minimal enough for the current phase. Revisit before adding truly sensitive records. |
| Scholar data source of truth | Mostly done | scholars-data.js is the canonical source; navigator reads via DataContext; claire/april pages read publicProfile. Remaining drift in project/site.jsx. |
| Apply/contact delivery | Done | Public homepage opens a prefilled `mailto:` to `jbshaw.cpa@gmail.com`. A real form endpoint remains optional. |
| Accessibility quick wins | Partial | Mobile nav ARIA, track radiogroup semantics, and visible radio focus states are in place; deeper keyboard/screen-reader testing remains. |
| Build system | Done — Vite adopted | All four pages are Vite entry points. `src/` holds React+JSX components. `project/` is kept as a Claude Design round-trip reference but is not the deployed source. |
| Navigator code split | Done | navigator.jsx split into section-level components under `src/components/` and `src/context/`. |
| Data state correctness | Done | Module-level mutable `D` replaced by React state in `Navigator`. Sheets updates now trigger re-renders across all sections. |
| Canonical source tree | Still open | Root files deploy; `project/` is the Claude Design split-source reference. Keep both synchronized unless/until a generator or build step is chosen. |

## Priority order

### 1. (Accepted risk for now) Navigator data is publicly exposed

- `navigator.html` shows student names, schools, GPAs, semester expense ledgers,
  peso amounts, budget allocations, and donor investment totals.
- The lock password is **cosmetic** — `scholars-data.js` is a public static asset;
  anyone can open it directly and read everything.
- Current decision: acceptable for the present phase because the owner considers
  the data minimally private. Keep the warning visible so future work does not
  mistake the lock for real security.
- Revisit immediately before adding bank details, IDs, full addresses, medical
  records, sensitive family notes, or anything the scholars would not want indexed.

#### Privacy/data-hosting options if the navigator needs real protection later

1. **Keep GitHub Pages + public `scholars-data.js`** — simplest and free, but no
   real confidentiality. Good only for intentionally public or low-sensitivity data.
2. **Google Sheets / Excel as the source, still published to static JS** — easier
   editing, but still public if the static site fetches the data without server-side auth.
3. **Private spreadsheet + tiny authenticated backend/serverless function** — a
   good middle path. The browser authenticates first; the backend returns only
   authorized data.
4. **Hosted database + auth provider** (Firebase/Supabase/Clerk/Auth0, etc.) —
   best if the navigator grows into a real app with roles and auditability.
5. **Password-protected hosting / private portal** — straightforward for a small
   private dashboard, but means moving off pure GitHub Pages.

### 2. (Mostly done) Single source of truth for scholar data

The data model is:

- **`scholars-data.js`** — static fallback + narrative/profile/display copy +
  cosmetic lock password. Source of truth for hand-authored fields (`english`,
  `publicProfile`, program config).
- **Google Sheets** — operational data for expenses, GPA, budgets, alerts,
  deadlines, and actions. Source of truth for anything the mentor edits weekly.
- **Frontend merge layer** — `sheets-loader.js` fetches Sheets tabs, then
  `Navigator` merges the result with static narrative fields and stores it in
  React state. All components read from the merged state via `DataCtx`.

Remaining items:
- `claire.html` and `april.html` read `publicProfile` from `scholars-data.js` —
  this is the right pattern; ensure it stays in sync.
- `project/site.jsx` still reads card payloads from `scholars-data.js`, with
  `project/index.html` loading the data file before the Babel JSX files. Any
  future Claude Design export can overwrite root files, so mirror changes deliberately.

### 3. (Still open) One canonical source tree

- Two entrypoints still exist: `project/` (Claude Design source/reference) and the
  root HTML + `src/` (what Vite builds and GitHub Pages deploys).
- Root files are the deploy-facing canonical output. `project/` should be kept
  aligned for Claude Design round-tripping.
- Direction: document a manual sync checklist or add a small generator if the two
  trees diverge frequently.

### 4. (Done) Build system — Vite adopted

Vite + React 18 is now the build system. All four HTML pages are Vite entry points.
The navigator and public profile pages compile JSX from `src/`. The `project/`
directory is retained as a Claude Design round-trip reference but does not deploy.

### 5. (Partially done) User-facing correctness and accessibility

- Apply/contact: done — prefilled `mailto:` on the homepage.
- Accessibility: ARIA and focus semantics improved on homepage; keyboard flow and
  screen-reader wording across all pages still need testing.

### 6. (Partial hygiene) Navigator and shared UI cleanup

- `project/app.jsx` applies `is-desktop` via post-render `querySelector` instead
  of a declarative prop — make viewport/desktop state declarative if the Claude
  Design source becomes more actively maintained.
- Centralize navigation into one shared component if root vs. `project/` nav
  behavior drifts again.

## Suggested next move

1. **Sync discipline:** after each Claude Design/Claude Code change, mirror root
   files and `project/` manually. Document the checklist.
2. **Accessibility pass:** keyboard flow and screen-reader audit across all public
   pages.
