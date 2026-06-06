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
| Navigator UI hygiene (project/app.jsx declarative state) | 🔵 Nice-to-have (project/ removed; n/a) |

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
  changes. Could be derived from Sheets data or removed in favour of a simpler
  "current semester" label pulled directly from `currentSem`.

---

## Phase 2 planning

_To be drafted. Add next-phase features and priorities here._
