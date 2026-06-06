# NextGen Scholars — Roadmap / Tech Debt

## Phase 1 status — all items resolved or classified

| Area | Status |
|---|---|
| Build system — Vite adopted | ✅ Done |
| Navigator code split into components | ✅ Done |
| Data state correctness (React state, no mutable module var) | ✅ Done |
| Single source of truth — scholars-data.js + Sheets merge | ✅ Done |
| One canonical source tree — project/ removed | ✅ Done |
| Apply/contact delivery — prefilled mailto on homepage | ✅ Done |
| Navigator password reads from Sheets Config | ✅ Done |
| Semester expense list on scholar profile pages | ✅ Done |
| Semester control (per-scholar dropdown) in navigator | ✅ Done |
| Navigator data publicly exposed | 🟡 Accepted risk — revisit if sensitive fields are added |
| Accessibility — keyboard/screen-reader audit | 🔵 Nice-to-have |

---

## Accepted risks (carry forward)

### Navigator data is publicly exposed

`scholars-data.js` is a public static asset. The lock password is cosmetic — anyone
can read the file directly. Current decision: acceptable because the owner considers
the data minimally private for the current phase.

**Revisit immediately** before adding bank details, full addresses, medical records,
IDs, or anything the scholars would not want publicly indexed.

Options when real protection is needed:
1. Private spreadsheet + tiny authenticated serverless function
2. Hosted database + auth provider (Firebase / Supabase / Clerk)
3. Password-protected hosting / private portal (moves off pure GitHub Pages)

---

## Nice-to-have (no priority)

- **Accessibility pass** — keyboard flow and screen-reader audit across all public pages.
- **publicProfile drift** — `currentSemester` block in `scholars-data.js` (intro text,
  subjects list, period label) is hand-authored and can drift when the active semester
  changes. Could be derived from Sheets data or removed in favour of a simpler label.

---

## Phase 2 — Refinement

### index.html

#### 2.1 Scholar cards side by side
- **Problem:** the 3 scholar cards (2 Active + 1 Paused) wrap or overlap instead of
  sitting in a clean side-by-side row.
- **Fix:** enforce a 3-column grid on the scholar status section; ensure equal card
  widths with a sensible mobile stack breakpoint.

### Top navigation (all pages)

#### 2.2 NGS brand mark — consistent across all pages
- Right now each page has a slightly different logo size, font weight, or spacing.
- Extract one canonical treatment: same navy/gold mark, same Newsreader display font,
  same size and padding — applied identically to `index.html`, `claire.html`,
  `april.html`, and `navigator.html`.

#### 2.3 Journey dropdown in top nav
- Change the "Journey" nav item from a plain anchor to a dropdown with 5 sub-items:
  1. High school
  2. University / Bootcamp
  3. Licensure
  4. Domestic Placement
  5. International Placement
- For Phase 2: sub-items anchor-link to the closest existing section on the current
  page. Items with no matching section yet render greyed/disabled ("coming soon").
- For Phase 3: each sub-item links to its own dedicated page.

#### 2.4 Additional nav shells
- **Scholars** — scrolls to / links to `index.html#scholars`.
- **Navigator** — links to `navigator.html` (password-protected mentor dashboard).
- These are shells; internal linking is sufficient for Phase 2.

### Scholar profile pages (claire.html / april.html)

#### 2.5 Expense summary above the semester expense table
- Add a compact summary row above the expense table showing:
  - Total actual spend for the semester
  - Total pending (budget) items
  - Item count
- Decision: **top summary preferred over right panel** — profile pages are
  mobile-first single-column; a sticky sidebar would require hiding below ~900px and
  doubles layout complexity for no gain on mobile.

#### 2.6 Homepage link
- A `← Home` button was added to the semester expense section header in Phase 1
  (PR #29). Confirm it is visible on the deployed page.
- If a more prominent placement is needed (e.g. persistent in the top nav or page
  footer), elevate it in the next implementation pass.

---

## Phase 3 — Separate pages per Journey stage (placeholder)

Each Journey dropdown item (2.3 above) gets its own dedicated page covering the
program narrative, scholar progress, costs, and milestones for that stage.

- `journey-highschool.html`
- `journey-university.html`
- `journey-licensure.html`
- `journey-domestic.html`
- `journey-international.html`

_Details to be scoped when Phase 2 is complete._
