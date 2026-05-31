# NextGen Scholars — Roadmap / Tech Debt

Captured from an architecture review (Codex) + situated prioritization for this
project's actual context (a small **private** mentorship tracker that is
round-tripped through **Claude Design** — see CLAUDE.md). Nothing here is done
yet; this is the agreed backlog.

> **Key framing the raw review missed:** the standalone-HTML + CDN-React setup
> is a *deliberate* constraint of the Claude Design workflow, not an oversight.
> Several "production best practice" recommendations (add a bundler, precompile,
> drop runtime Babel) directly conflict with that workflow and are a **fork to
> decide**, not a pure win. Decide the workflow before any large refactor.

## Priority order

### 1. (Do sooner) Private data is publicly exposed
- `navigator.html` shows real students' names, schools, GPAs, semester expense
  ledgers, peso amounts, budget allocations, and donor investment totals.
- The `password: 'ngs2026'` lock is **cosmetic** — `scholars-data.js` is a
  public static asset; anyone can open it directly and read everything. The
  password never protects the data.
- Distinction: the public profile pages (`index.html`, `claire.html`,
  `april.html`) are *intended* public. The **navigator is intended private but
  is currently fully public.** That mismatch is the real issue.
- **Direction:** if the navigator is private, put it behind real auth and load
  its data only after authorization (a backend or hosted auth provider; or move
  the sensitive data off the public static site entirely). At minimum, stop
  shipping the sensitive ledger as a public asset.

### 2. (High value, workflow-compatible) Single source of truth for scholar data
- Scholar facts are duplicated across `index.html` cards, `claire.html`,
  `april.html`, `scholars-data.js`, and `project/site.jsx`. They already drift
  (caused real bugs this project hit).
- **Direction:** consolidate to one data file that the landing cards, profile
  pages, and navigator all derive from. Safest high-leverage step; compatible
  with either workflow direction.

### 3. (Decide first) One canonical source tree
- Two competing entrypoints exist: `project/` (split Claude Design source) and
  the hand-edited root `index.html` (and the other root HTML files). They drift;
  it's unclear which is canonical.
- **Direction:** pick one canonical source. If root files are the deploy target,
  ideally generate them from source rather than hand-maintaining both.

### 4. (Decide first) Build system vs. Claude Design — the fork
- Current: runtime Babel + CDN **development** React shipped to users.
- **Option A — keep Claude Design round-tripping:** standalone HTML stays;
  accept the duplication + perf cost.
- **Option B — real build (Vite/Astro/Next):** faster, deduplicated, testable,
  real modules — but you lose the Claude Design visual round-trip and edit in
  code instead.
- You can't fully have both. **Choose consciously before investing in 2–4.**

### 5. (Before any real launch) User-facing correctness
- **Apply form (`index.html`)** sets `sent = true` locally but submits nowhere —
  users think a nomination was sent when nothing is delivered. Wire to a real
  endpoint (Formspree/Netlify Forms/mailto/backend) or relabel as prototype.
- **Accessibility:** mobile nav button lacks `aria-expanded`/`aria-controls` and
  focus management; track-selection "buttons" act like radios without radio
  semantics/`aria-pressed`. Add proper ARIA + visible focus states.

### 6. (Hygiene, low urgency while data is static & self-authored)
- `navigator.html` builds DOM via string `innerHTML` interpolation — fine today
  (static, self-authored data) but XSS-prone if data ever becomes external/
  user-editable. Prefer `textContent`/DOM APIs, or fold the navigator into the
  same component architecture as the public pages.
- `project/app.jsx` applies `is-desktop` via post-render `querySelector` instead
  of a declarative prop — make viewport/desktop state declarative in React.
- Centralize navigation into one shared component (root vs. `project/` nav
  behavior currently differs).

## Suggested first move
When ready to act, **start with #2 (consolidate scholar data)** — safest,
highest value, and works regardless of the #3/#4 workflow decision. Tackle #1
(privacy) on its own track since it's about data exposure, not refactoring.
