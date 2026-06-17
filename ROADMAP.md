# NextGen Scholars — Roadmap / Tech Debt

## Phase 1 — Build system & data correctness ✅ Complete

| Area | Status |
|---|---|
| Build system — Vite adopted | ✅ Done |
| Navigator code split into components | ✅ Done |
| Data state correctness (React state, no mutable module var) | ✅ Done |
| Single source of truth — scholars-data.js + Supabase merge | ✅ Done |
| One canonical source tree — project/ and chats/ removed | ✅ Done |
| Apply/contact delivery — prefilled mailto on homepage | ✅ Done |
| Navigator password reads from Supabase config | ✅ Done |
| Semester expense list on scholar profile pages | ✅ Done |
| Semester control (per-scholar dropdown) in navigator | ✅ Done |

---

## Phase 2 — Refinement ✅ Complete

| Area | Status |
|---|---|
| Scholar cards side by side (3-column grid, mobile stack) | ✅ Done |
| NGS brand mark consistent across all pages | ✅ Done |
| Journey dropdown in top nav (JourneyDropdown.jsx) | ✅ Done |
| Scholar profile pages share homepage nav format | ✅ Done |
| Expense summary above semester expense table | ✅ Done |
| Homepage ← back link on profile pages | ✅ Done |
| FX widget standardisation (PHP/USD · Market/Manual) | ✅ Done |
| Deadlines sort fixed (localeCompare on ISO dates) | ✅ Done |
| Actions checklist write-back to Supabase | ✅ Done |
| Add Expense inline form with optimistic updates | ✅ Done |
| Navigator data Refresh button | ✅ Done |
| Hero meta stats (2 active · 1 paused format) | ✅ Done |
| Track card Apply pre-select | ✅ Done |
| Log section removed from Navigator | ✅ Done |
| Mark as Sent button styling | ✅ Done |

---

## Phase 3 — SPA migration (in progress)

Converting from multi-page app (9 separate HTML entry points) to a single-shell
SPA, with PWA support as the path toward a React Native mobile app.

See `docs/SPA-MIGRATION-ROADMAP.md` for full plan and route map.

| Phase | Status | Detail |
|---|---|---|
| Phase 1 — React Router + single shell | ✅ Done | `index.html` → `App.jsx`, HashRouter, 404.html redirect, legacy URL map |
| Phase 2 — Shared AuthContext | 🔵 Pending | Replace per-page LockScreen + sessionStorage with unified `AuthContext` + `<ProtectedRoute>` |
| Phase 3 — Navigation cleanup | 🔵 Pending | Replace `window.location.href` and `<a href="*.html">` with `useNavigate()` + `<Link>` |
| Phase 4 — PWA | 🔵 Pending | `vite-plugin-pwa`, manifest.json, service worker, offline shell |

---

## AI Intelligence Layer

Tiered system — Tier 1 (smart query, no LLM) handles ~80%, escalates to
Tier 2 (Gemini advisory) or Tier 3 (Gemini ingestion).

See `ROADMAP-AI.md` for full step-by-step status.

**Current position:** Steps 1–13, 19–20 complete. Step 14 next (Career tracker).

| Step | Area | Status |
|---|---|---|
| 1–13 | Schema, edge functions, Tier 1–3, review UI, coaching, risk alerts, OET readiness, budget trajectory, documents tracker | ✅ Done |
| 19–20 | Multi-file ingest, grade screenshot ingestion | ✅ Done |
| **14** | **Career tracker — PNLE → OET → NCLEX → AHPRA checklist** | **Next** |
| 15 | Risk/cohort dashboard | 🔵 Pending |
| 16 | Mentor weekly report draft (Tier 2) | 🔵 Pending |
| 17 | Scholar pathway chatbot | 🔵 Pending |
| 18 | RLS hardening | 🔵 Pending |
| 21–22 | Navigator AI in entry module · Google Drive storage backend | 🔵 Pending |

### Pending manual step

> Run `supabase/gpa_risk_trigger.sql` in the Supabase SQL editor to activate
> auto-generated GPA risk alerts (Step 10 trigger not yet deployed).

---

## Accepted risks (carry forward)

### Navigator data is publicly accessible

`scholars-data.js` is a public static asset. The lock password is cosmetic —
anyone can read the file directly. Current decision: acceptable because the
owner considers the data minimally private for the current phase.

**Revisit immediately** before adding bank details, full addresses, medical
records, IDs, or anything the scholars would not want publicly indexed.

The Supabase Row Level Security (RLS) hardening (Step 18) is the planned
mitigation for the operational data layer. The static narrative copy in
`scholars-data.js` will always be public while the site is on GitHub Pages.

### RLS policies are permissive for anon users

Current anon access allows reading scholar operational data via the Edge
Functions. Step 18 will restrict anon reads to the `config` table only.
Non-blocking for current phase; **do not store sensitive PII before Step 18.**

---

## Nice-to-have (no priority)

- **Accessibility pass** — keyboard flow and screen-reader audit across all pages.
- **publicProfile drift** — `currentSemester` block in `scholars-data.js`
  (intro text, subjects list, period label) is hand-authored and can drift when
  the active semester changes. Derive from Supabase data or replace with a
  simpler generated label.
- **TypeScript** — frontend is pure JS/JSX; no type checking on component props
  or Supabase query results.
- **Test harness** — no unit or integration tests exist.
