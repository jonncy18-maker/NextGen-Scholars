# NextGen Scholars — Roadmap / Tech Debt

Captured from an architecture review (Codex) + situated prioritization for this
project's actual context (a small mentorship tracker that is round-tripped
through **Claude Design** — see CLAUDE.md). This file is now a status-tracked
backlog: some early roadmap items are complete or intentionally accepted, while
larger architecture choices remain open.

> **Key framing:** the standalone-HTML + CDN-React setup is a *deliberate*
> constraint of the Claude Design workflow, not an oversight. Several
> "production best practice" recommendations (add a bundler, precompile, drop
> runtime Babel) directly conflict with that workflow and are a **fork to
> decide**, not a pure win. Decide the workflow before any large refactor.

## Status summary

| Area | Status | Notes |
|---|---|---|
| Public navigator data exposure | Accepted risk for now | The navigator password is cosmetic, but the owner confirmed the exposed data is minimal enough for the current phase. Revisit before adding truly sensitive records. |
| Scholar data source of truth | Mostly done | Root landing cards, Claire/April public pages, navigator, and `project/site.jsx` now read scholar facts from `scholars-data.js`. |
| Apply/contact delivery | Lightweight fix done | The public homepage and Claude Design source open a prefilled `mailto:` to `jbshaw.cpa@gmail.com`. A real form endpoint remains optional. |
| Accessibility quick wins | Partial | Mobile nav ARIA, track radiogroup semantics, and visible radio focus states are in place on the deployed homepage; deeper focus-management testing remains. |
| Navigator DOM injection hygiene | Partial | Dynamic interpolation is escaped before `innerHTML`; replacing string templates with DOM APIs is still optional future hardening. |
| Canonical source tree | Still open | Root files deploy; `project/` remains the Claude Design split-source reference. Keep both synchronized unless/until a generator or build step is chosen. |
| Build system vs. Claude Design | Intentionally deferred | Do not introduce Vite/Next/Astro/bundling unless the owner chooses to leave or redesign the Claude Design workflow. |

## Priority order

### 1. (Accepted risk for now) Navigator data is publicly exposed

- `navigator.html` shows student names, schools, GPAs, semester expense ledgers,
  peso amounts, budget allocations, and donor investment totals.
- The `password: 'ngs2026'` lock is **cosmetic** — `scholars-data.js` is a
  public static asset; anyone can open it directly and read everything. The
  password never protects the data.
- Current decision: this is acceptable for the present phase because the owner
  considers the data minimally private. Keep the warning visible so future work
  does not mistake the lock for real security.
- Revisit immediately before adding bank details, IDs, full addresses, medical
  records, sensitive family notes, or anything the scholars would not want
  indexed/forwarded.

#### Privacy/data-hosting options if the navigator needs real protection later

1. **Keep GitHub Pages + public `scholars-data.js`** — simplest and free, but no
   real confidentiality. Good only for intentionally public or low-sensitivity
   data.
2. **Google Sheets / Excel as the source, still published to static JS** — easier
   editing and less hand-maintained JSON, but still public if the static site
   fetches or ships the data without authenticated server-side access.
3. **Private spreadsheet + tiny authenticated backend/serverless function** — a
   good middle path. The browser authenticates first; the backend reads the
   private Sheet/Excel file/API and returns only authorized data.
4. **Hosted database + auth provider** (Firebase/Supabase/Clerk/Auth0, etc.) —
   best if the navigator grows into a real app with roles, auditability, and
   multiple mentors, but adds setup and operating complexity.
5. **Password-protected hosting / private portal** — straightforward for a small
   private dashboard, but it likely means moving the navigator off pure GitHub
   Pages or fronting it with a service that supports real access control.

### 2. (Mostly done) Single source of truth for scholar data

- `scholars-data.js` is now the canonical source for scholar cards and public
  profile payloads.
- Root `index.html` reads Claire, April, and Aljane cards from
  `NGS_DATA.scholars.*.card`.
- `claire.html` and `april.html` read their public profile payloads from
  `NGS_DATA.scholars.*.publicProfile`.
- `project/site.jsx` now also reads the same card payloads, with
  `project/index.html` loading `../scholars-data.js` before the Babel JSX files.
- Remaining watch item: any future Claude Design export can still overwrite root
  files, so changes must be mirrored deliberately until a canonical build/export
  path exists.

### 3. (Still open) One canonical source tree

- Two entrypoints still exist: `project/` (split Claude Design source/reference)
  and the root HTML files (what GitHub Pages deploys).
- Root files should currently be treated as deploy-facing canonical output.
  `project/` should be kept aligned because it is the Claude Design round-trip
  source.
- Direction: if this repo grows, either document a manual sync checklist or add
  a small generator that produces root `index.html` from `project/` without
  breaking Claude Design imports.

### 4. (Intentionally deferred) Build system vs. Claude Design — the fork

- Current: standalone HTML pages use CDN React + ReactDOM + Babel Standalone.
- **Option A — keep Claude Design round-tripping:** standalone HTML stays; accept
  some duplication, runtime Babel, and manual sync discipline.
- **Option B — real build (Vite/Astro/Next):** faster, deduplicated, testable,
  real modules — but likely loses the current Claude Design visual round-trip.
- You cannot fully have both. Choose consciously before investing in a larger
  refactor.

### 5. (Partially done) User-facing correctness and accessibility

- Apply/contact:
  - Done: the deployed homepage now opens a prefilled email to
    `jbshaw.cpa@gmail.com` and tells users they still need to hit Send.
  - Optional later: replace `mailto:` with Formspree, Netlify Forms, Google Form,
    or a backend endpoint if you want guaranteed delivery and analytics.
- Accessibility:
  - Done: deployed mobile nav exposes `aria-expanded`/`aria-controls`.
  - Done: track-selection controls use radiogroup/radio semantics and visible
    focus styles.
  - Remaining: test keyboard flow, focus return after mobile-menu interactions,
    and screen-reader wording across all public pages.

### 6. (Partial hygiene) Navigator and shared UI cleanup

- `navigator.html` still uses string `innerHTML`, but dynamic values are escaped
  with `esc()` before interpolation. This is acceptable while data is static and
  self-authored, but should be replaced with DOM APIs or components before
  accepting external/user-editable data.
- `project/app.jsx` applies `is-desktop` via post-render `querySelector` instead
  of a declarative prop — make viewport/desktop state declarative in React if the
  Claude Design source becomes more actively maintained.
- Centralize navigation into one shared component if root vs. `project/` nav
  behavior drifts again.

## Suggested next move

Keep `scholars-data.js` as the single data source. For the next technical pass,
choose between:

1. **Manual sync discipline:** keep root deploy files and `project/` aligned by
   checklist after each Claude Design/Claude Code change; or
2. **A small no-bundler generator:** preserve Claude Design compatibility while
   generating the deploy-facing root homepage from the split source.
