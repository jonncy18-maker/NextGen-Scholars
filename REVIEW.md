# Structural Review — NextGen Scholars

**Date:** 2026-06-05  
**Reviewer:** Claude Code  
**Overall Health:** Healthy — No blocking issues

All 4 entry points wire correctly to their Vite build targets, all 27 source files exist, all imports resolve, and the static/Sheets data merge works end-to-end.

---

## Issues Found

### 1. `ScholarProfile.jsx` duplicates FX logic — Medium Priority

`src/components/Profile/ScholarProfile.jsx` line 7 defines a local `useFxState()` hook that re-implements what `FxContext` already provides. The profile pages (claire, april) source the FX rate independently from the navigator, meaning the rate can drift between pages if the market rate updates mid-session. Should consume `useFxContext()` from `src/context/FxContext.jsx` instead.

### 2. README.md references missing `project/` directory — Cosmetic

`README.md` line 37 describes a "Claude Design split-source reference" at `project/`. That directory no longer exists in the repo. The reference is misleading and should be removed or updated to note it's been archived.

### 3. Apps Script URL is hardcoded with no setup docs — Low Priority

`src/sheets-writer.js` line 5 contains the deployed Apps Script URL directly in source. There is no comment or documentation noting that this URL must be updated if the Apps Script is redeployed. A note in `CLAUDE.md` or a comment in the file would prevent silent breakage during redeployment.

### 4. Sheets writes fail silently — Low Priority

`src/sheets-writer.js` uses a fire-and-forget `fetch` pattern. If a write fails (network issue, Apps Script error, quota exceeded), the user receives no feedback. Affected operations: expense add form, action item toggles, send-log writes. Consider a UI toast or NavFooter status indicator on write failure.

### 5. Scholar facts duplicated across files — Backlog (already in CLAUDE.md)

Scholar data lives in `scholars-data.js`, `claire.html`, `april.html`, and the public profile components. These can drift over time. The highest-value safe refactor is consolidating all public profile payloads to read exclusively from `scholars-data.js`.

---

## What's Healthy (no action needed)

| Area | Status |
|---|---|
| All imports / file paths | Resolve cleanly |
| Vite multi-page config | Correct — 4 entry points, `/NextGen-Scholars/` base |
| DataContext + FxContext | Clean providers and consumers throughout |
| Scholar data schema | All 3 scholars (claire, april, aljane) consistent |
| CSS token system | Token-based `--ngs-*` vars, consistent naming |
| GitHub Actions deploy | Correct — builds Vite, pushes to `gh-pages` |
| Sheets fallback logic | Merge works correctly on Sheets failure |
| Component exports | All 14+ components exported and imported correctly |
| `sheets-loader.js` | Reads 10 sheets, merges with static data cleanly |
| `scholars-data.js` | 628 lines, coherent schema, all cross-references resolve |

---

## Fix Priority Order

| # | Issue | Priority | File |
|---|---|---|---|
| 1 | Fix `ScholarProfile.jsx` FX duplication | Medium | `src/components/Profile/ScholarProfile.jsx` |
| 2 | Add Sheets write error feedback | Low | `src/sheets-writer.js` |
| 3 | Remove stale `project/` reference from README | Cosmetic | `README.md` |
| 4 | Consolidate duplicated scholar facts | Backlog | `scholars-data.js`, `claire.html`, `april.html` |
