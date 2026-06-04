# NextGen Scholars — Architecture Decisions & Change Log

## Data Architecture Decision (June 2026)

### Decision: All pages read live data from Google Sheets

**Context:** The navigator reads live Sheets data on load. The public pages
(index.html, claire.html, april.html) previously read only from the static
`scholars-data.js` file, causing financial totals and other displayed values
to drift whenever the database was updated.

**Decision:** All pages now call `loadFromSheets()` on mount and merge the live
data over the static base values. `scholars-data.js` remains the source of
truth for:
- Narrative / descriptive text (section intros, pathway labels, English stage labels)
- Scholar photos and card copy
- Fallback values when Sheets is unavailable

Google Sheets is the source of truth for:
- All expense amounts and rows
- GPA history
- Milestone and travel states
- Budgets and allocations
- Alerts, deadlines, and action items
- Program config (exchange rate, password)

**Why not use the navigator as intermediary?** The navigator runs in a separate
browser tab. Cross-page messaging (postMessage, BroadcastChannel) would
add complexity and still require both pages to be open. Fetching from Sheets
directly in each page is simpler, uses the existing `loadFromSheets()` utility,
and keeps the fallback behavior intact.

---

## Sprint: June 2026 — 16-Point Improvement

### 1. Data connection (see above)
`claire.jsx` and `april.jsx` now call `loadFromSheets()` and merge live computed
values (total invested, category totals, latest GPA, milestone/travel states)
over the static `publicProfile` base.

### 2. FX widget standardization
All pages (navigator, claire.html, april.html) now use the same labels:
- Currency toggle: `PHP ₱` / `USD $` (full text, not abbreviations)
- Mode toggle: `Market` / `Manual` (not `Mkt` / `Man`)
- Error indicator uses the same red circle treatment as navigator

### 3. Back link consistency
All pages now use `← All scholars` (with left arrow) matching the navigator.

### 4. Scholar name casing
`NAMECLASS` in navigator.jsx now uses lowercase keys (`claire`, `april`,
`aljane`) matching the lowercase scholar keys in data objects. This fixes
the color-tag styling bug in alerts, deadlines, and actions.

### 5. English section data-driven
The navigator's English Pulse section (§06) is now driven by
`D.scholars[k].english` data in `scholars-data.js`. Each scholar has an
`english` block with `scholar`, `stage`, `desc`, and `observations[]`.
When Sheets data loads, the static `english` block is merged back so it
is never lost.

### 6. Add Expense form
A `+ Add Expense` button in the Expense Dashboard (§03) opens an inline form
above the expense table. Fields: Item, Category, Amount, Qty, Date, Semester
(with datalist of existing sems), Status (Actual/Budget), Sent, Vendor.

On submit:
- Row appears immediately in the expense table (optimistic update in `addedExpenses` state)
- `writeExpense()` fires a no-cors POST to the Apps Script web app
- The form clears for another entry (showing "✓ Saved" briefly)
- Added rows persist across scholar tab switches (state held in Navigator)

**Apps Script requirement:** The deployed `doPost` handler must support
`action: 'addExpense'` with fields `scholar, sem, item, cat, amount, qty,
date, avb, sent, vendor` — it should append a row to the Expenses sheet.

### 7. Log section removed
The "Log Update" section (previously §03) has been removed from the navigator.
Its primary use (text-note logging) was low-value and cluttered the flow.
GPA tracking is now handled by observing the Scholar Status cards which reflect
live Sheets data.

Section numbers: Expense Dashboard moved to §03, Deadlines §04, Actions §05,
English §06.

### 8. Mark as Sent button
The "No →" inline button is replaced with a more prominent `Mark Sent →`
button styled in green (matching the Actual status color) with a visible
border. The confirmed state now shows `✓ Sent` in matching green.

### 9. Deadlines sort
Fixed: was using `a.sort - b.sort` (string subtraction → NaN). Now uses
`a.sort.localeCompare(b.sort)` which correctly sorts ISO date strings.

### 10. Actions checklist write-back
Toggling an action item now calls `writeActionToggle(id, done)` which posts
`{ action: 'toggleAction', id, done }` to the Apps Script web app.

**Apps Script requirement:** The deployed `doPost` handler must support
`action: 'toggleAction'` with fields `id, done` — it should update the
`done` column on the matching Actions row.

Note: the checked state is still session-local (React state). The write-back
persists the intent to Sheets but the checkbox won't survive a page refresh
until the Apps Script also returns the done state in the Sheets CSV read.

### 11. Hero meta stats
Changed from the ambiguous `2·1 active·paused` monogram format to two
separate stat items: `2 active` and `1 paused`, each with a `<strong>` value
and `<span>` label, following the same pattern as the other hero meta stats.

### 12. Track card Apply pre-select
The Apply form now accepts a `defaultTrack` prop from `NGSSite`. When a visitor
clicks "Apply to NGN" or "Apply to NGH" on a track card, `onSelectTrack` fires
and the form scrolls to `#apply` with the corresponding track pre-selected.

### 13. Scholar photo placeholders
Left as-is (pending actual photo assets).

### 14. Apply form email
Changed from `hello@nextgenscholars.ph` to `jbshaw.cpa@gmail.com` throughout
the Apply form and footer.

### 15. Navigator data refresh
A `↻ Refresh` button has been added to the navigator's sticky nav bar. Clicking
it increments `refreshKey` which re-triggers the `loadFromSheets()` useEffect.
The button shows a spinning animation and gold color while loading.

### 16. "Mentor view" footer link removed
The semi-hidden `Mentor view →` link in the homepage footer has been removed.
Access to the navigator is now via the **Menu → Expenses** item added to the
top navigation (§7 above).

---

## Menu component (index.html)

A `QuickMenu` dropdown has been added to the desktop nav bar and the mobile
hamburger menu.

Desktop: appears as the last item in the nav, opening a dropdown with:
- **Home** → `#top` (scrolls to hero)
- **Expenses** → `navigator.html`

Mobile: appears below a divider in the hamburger menu with the same two items.

The dropdown closes on outside click (uses `mousedown` listener on document).

---

## Shared utilities

`src/utils.js` was created to hold `allExpenses`, `scholarTotals`,
`nextMilestone`, and `accentFor` — previously duplicated in navigator.jsx.
These are now imported by navigator.jsx, claire.jsx, and april.jsx.

`src/sheets-writer.js` was updated with named convenience wrappers:
- `writeSent(id, scholar)` — marks expense as sent
- `writeExpense(scholar, exp)` — adds a new expense row
- `writeActionToggle(id, done)` — toggles an action item
- `writeLog(entry)` — logs a text update (kept for future use)
