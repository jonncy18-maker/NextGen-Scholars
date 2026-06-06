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

#### 2.2 NGS brand mark — consistent across all pages ✅ Done
- All four pages now use `.ngs-mark.ngs-mark-sm` — same 11px navy/gold monogram at
  5px/8px padding. The navigator's `NavBar.jsx` was updated to include `ngs-mark-sm`.

#### 2.3 Journey dropdown in top nav ✅ Done
- Dropdown with 5 sub-items lives in the shared `src/components/JourneyDropdown.jsx`
  component (extracted from HomePage). Stage data is in `src/constants.js`.
- Desktop: chevron-triggered panel; mobile: accordion toggle in the slide-out menu.
- For Phase 3: update `JOURNEY_STAGES[i].href` to point to dedicated journey pages.

#### 2.4 Additional nav shells ✅ Done
- Scholar profile pages (`claire.html`, `april.html`) now share the same nav format
  as the homepage: About · Tracks · Journey ▾ · Scholars · Navigator · Apply.
- All anchors prefixed with `index.html` since profiles are on a different page.
- FX widget stays in the nav (right side) per design decision.
- Mobile: hamburger → slide-out menu with Journey accordion.
- Navigator page nav is unchanged (operational UI with FX widget + Refresh + Sheets
  status is kept separate from the decorative public nav).

### Scholar profile pages (claire.html / april.html)

#### 2.5 Expense summary above the semester expense table ✅ Done
- `SemesterExpenseSection` in `ScholarProfile.jsx` renders `.ngs-semexp-summary`
  above the table: Actual spend · Pending (budget items) · Item count.

#### 2.6 Homepage link ✅ Done
- `← Home` button exists in the semester expense section header
  (`ScholarProfile.jsx`, `SemesterExpenseSection`). Links to `index.html`.

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
