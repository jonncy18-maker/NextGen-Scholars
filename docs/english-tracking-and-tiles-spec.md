# English Tracking Page + Scholar Home Tile Wiring

Two related tasks for the next session. Do them in order — the tile wiring
depends on having the target pages to link to.

---

## Task 1 — English Tracking Page

### Purpose
A scholar-facing page where Claire and April can log English study hours,
see their running total vs. target, and review history. Linked from the
**English Hours** tile on `claire-home.html` / `april-home.html`.

### Page URL
`english.html` → entry point `src/english.jsx`  
Add to Vite config the same way `claire-home` and `april-home` were added.

### Supabase data needed
The navigator has an `EnglishSection` component at
`src/components/EnglishSection.jsx` — **it does not use Supabase**. It reads
static qualitative data from `scholars-data.js` via `useData()`:
`D.scholars[sk].english` → `{ scholar, stage, desc, observations[] }`.
That is narrative text, not session hours. The two pages have nothing to share.

**No `english_sessions` table exists yet.** Create it with at minimum:
| column | type | notes |
|---|---|---|
| id | uuid | pk |
| scholar | text | 'claire' or 'april' |
| date | date | |
| duration_minutes | int | |
| activity_type | text | e.g. 'OET Practice', 'Speaking', 'Listening', 'Reading', 'Writing', 'Other' |
| notes | text | optional |
| created_at | timestamptz | |

### Target per scholar
- **Claire**: 200 hours / semester (check if this is already in config or EnglishSection)
- **April**: TBD — check with Jonncy before hardcoding

### UI layout (mobile-first, same design language as scholar home)
1. **Header** — navy block, same `.sp-head` pattern, title "English Hours"
2. **Progress card** — large number (e.g. "128 hrs"), progress bar toward target,
   percentage complete, current semester label
3. **Log session button** — opens inline form:
   - Date (default today)
   - Duration (minutes or hours — pick one and be consistent)
   - Activity type (dropdown from list above)
   - Notes (optional)
   - Submit → writes to Supabase, updates running total optimistically
4. **Session history** — list of past sessions, grouped by month, most recent first.
   Each row: date · activity type · duration · optional notes
5. **Footer** — same `.sp-footer` NGS mark pattern

### Auth
The scholar home pages (`claire-home.html`, `april-home.html`) currently have
**no auth guard** — they render `ScholarHome` directly with no session check.
The LockScreen / `supabase.auth.getSession()` pattern exists only in
`navigator.html`. Until a shared auth layer is built for scholar-facing pages,
load the page with the scholar key from a URL param (`?scholar=claire`) — the
tile href passes it, and the page reads it from `new URLSearchParams(location.search)`.
Do **not** redirect to `index.html` for now; that will be wired when scholar auth
is added globally.

### Files to create
- `english.html`
- `src/english.jsx`
- `src/pages/EnglishTracking.jsx` (main component)
- `src/styles/english-tracking.css` (or reuse `scholar-home.css` tokens)

---

## Task 2 — Wire the Tracker Tiles on Scholar Home

Once pages exist, update the `TRACKERS` array in
`src/pages/ScholarHome.jsx` to point tiles at real URLs.

Current stub hrefs are all `'#'`. Replace each as the target pages are built:

| Tile key | Current href | Target when built |
|---|---|---|
| `english` | `#` | `english.html?scholar={scholarKey}` |
| `vacation` | `#` | `vacation.html` or scholar profile travel section |
| `career` | `#` | `career.html` (future) |
| `rewards` | `#` | scholar profile milestones section or `rewards.html` |
| `messages` | `#` | `messages.html` (future) |
| `docs` | `#` | `documents.html` (future) |

**English tile — do this in the same session as Task 1.**
Update `src/pages/ScholarHome.jsx`:
```js
{ key: 'english', ..., href: `english.html?scholar=${scholarKey}` },
```

Also update the English tile `sub` blurb to show live hours:
- Load from Supabase: `sum(duration_minutes)` for the scholar's current semester
- Display as e.g. `"128 / 200 hrs"` or `"64%"` if target is known
- Fallback: `"Log hours"` if no sessions yet

**Rewards tile — update now (Supabase data already loaded).**
The `rewardsCount` is already fetched in `ScholarHome.jsx`. The href can
point to the scholar's existing profile page at their milestones anchor:
```js
{ key: 'rewards', ..., href: `${scholarKey}.html#milestones` }
```

**Vacation tile — update now if possible.**
`NGS_DATA.scholars[scholarKey].travels` has the latest booked travel.
The href can point to the scholar profile travel section:
```js
{ key: 'vacation', ..., href: `${scholarKey}.html#travel` }
```

---

## Notes for the next session

**Verified codebase state (2026-06-10):**

- `src/components/EnglishSection.jsx` — qualitative static data only (stage
  label + observation bullets from `scholars-data.js`). No Supabase. Skip it
  for this task.
- `src/supabase-loader.js` — no English data loaded anywhere. The `english`
  property on each scholar object comes entirely from `scholars-data.js`.
- `src/pages/ScholarHome.jsx` TRACKERS (lines 111–118) — all six tiles still
  point to `href: '#'`. Nothing has been wired yet.
- Vite config currently has entries: `main`, `claire`, `april`, `navigator`,
  `entry`, `claire-home`, `april-home`. Add `english` following that pattern.
- Scholar home pages have no auth at all — URL param approach is correct for now.
- The `rewardsCount` live data is already loaded in `ScholarHome.jsx` via
  Supabase (lines 70–74); the rewards tile href update is a one-liner.
- Keep the CSS in the `--ngs-*` token system. Reuse `.sp-*` classes from
  `src/styles/scholar-home.css` where the pattern fits (header, footer,
  eyebrow, cards).
- After building, update `CLAUDE.md` to document the new pages and Supabase table.
