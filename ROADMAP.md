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
  ledgers, peso amounts, donor investment totals.
- The `password: 'ngs2026'` lock is **cosmetic** — `scholars-data.js` is a
  public static asset; anyone can open it directly and read everything. The
  password never protects the data.
- Distinction: the public profile pages (`index.html`, `claire.html`,
  `april.html`) are *intended* public. The **navigator is intended private but
  is currently fully public.** That mismatch is the real issue.
- **Decision (2026-05-31):** Accept for now — scholars have consented and the
  program is small. Revisit when the program grows or if a real backend is added.
- **Direction (when ready):** put the navigator behind real auth and load its
  data only after authorization (a backend or hosted auth provider; or move the
  sensitive data off the public static site entirely).

### 2. ✅ (Done) Single source of truth for scholar data
- Consolidated to `scholars-data.js` — `index.html`, `claire.html`, `april.html`
  all read from `NGS_DATA` instead of hardcoding scholar details.

### 3. ✅ (Done) One canonical source tree
- **Decision (2026-05-31):** root HTML files are canonical; `project/` (stale
  Claude Design split source) deleted.

### 4. (Decided) Build system vs. Claude Design — keep Claude Design
- **Decision (implied by #3):** standalone HTML + CDN React stays. No bundler.
  Claude Design round-trip is the workflow.

### 5. ✅ (Done) User-facing correctness
- Apply form wired to `mailto:` — nominations now actually reach the team.
- Accessibility: `aria-expanded`/`aria-controls` on mobile nav toggle;
  `role="radiogroup"` + `role="radio"` + `aria-checked` on track selector;
  `:focus-visible` outlines on all interactive elements.

### 6. ✅ (Done) Navigator innerHTML / XSS hygiene
- Added `esc()` HTML-escape helper; applied to every data value interpolated
  into `innerHTML` strings throughout `navigator.html`.
- `renderLogFeed()` converted to DOM API (`textContent`) — the only section
  with live user input, so the only immediate XSS sink.
- Note: `project/app.jsx` declarative viewport item is moot — `project/` deleted.
- Note: navigation centralization across pages deferred (conflicts with Claude
  Design standalone-file constraint).
