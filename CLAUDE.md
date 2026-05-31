# NextGen Scholars — Project Context

Private mentorship-program website + mentor dashboard for a privately funded
program supporting Filipino nursing students (NGN track) on a pathway toward
licensure abroad (PH → OET → NCLEX → AHPRA Australia).

- **Repo:** `jonncy18-maker/NextGen-Scholars` (renamed from `NexGen`)
- **Live:** https://jonncy18-maker.github.io/NextGen-Scholars/ (GitHub Pages, `main`)

## ⚠️ Critical constraint: Claude Design round-trip

The HTML files are intentionally **standalone, browser-runnable files** (CDN
React + ReactDOM + Babel Standalone, JSX compiled in-browser). This is a
deliberate choice so the owner can re-import/edit them in **Claude Design** and
re-export. **Do NOT introduce a build system (Vite/Next/Astro/bundler) or
convert to precompiled modules without explicitly discussing it first** — it
breaks the Claude Design workflow. Performance/"best practice" arguments for a
build step are understood and intentionally deferred (see ROADMAP.md).

## Files

| File | Role |
|---|---|
| `index.html` | Public homepage (hero, tracks, journey, "Meet the Scholars", apply form). Auto-responsive. Scholar cards link to `claire.html` / `april.html`. |
| `claire.html` | Public scholar dashboard — Claire (active BSN). |
| `april.html` | Public scholar dashboard — April (trial period, Grade 11). |
| `navigator.html` | **Private** mentor ops dashboard. Reads `scholars-data.js`. Has a cosmetic password lock. |
| `scholars-data.js` | Single source of truth for all scholar data (public cards, profiles, and navigator financials). |
| `chats/`, `README.md` | Original Claude Design handoff transcripts + notes. |

## How the standalone HTML files are built

- Each page inlines its JSX in `<script type="text/babel">` blocks.
- **Separate `<script>` blocks are separate compilation units.** A `const`/
  function in one block is NOT visible by name in another unless exported via
  `window.*` and re-read there. (This caused real bugs — duplicate `const`
  declarations, and cross-block `undefined` references.)
- Auto-responsive (mobile ↔ desktop) is done with
  `window.matchMedia('(min-width: 960px)')` + a resize listener, toggling
  `is-desktop` / `is-mobile` classes. No device frames in the deployed files.

## navigator.html + scholars-data.js gotchas

- `scholars-data.js` declares `const NGS_DATA = {...}`. A top-level `const`
  lives in the shared global **lexical** scope (accessible by bare name in a
  later classic `<script>`) but is **NOT** a property of `window`. So
  `window.NGS_DATA` is `undefined` — reference `NGS_DATA` directly (navigator
  binds `const D = (typeof NGS_DATA !== 'undefined') ? NGS_DATA : window.NGS_DATA`
  and mirrors it back onto `window`). There is a guard that fails visibly on the
  lock screen if the data file doesn't load.
- The navigator's render logic was adapted to the real `scholars-data.js` shape
  (rolled-up totals from `scholarTotals()`, `nextMilestone()`, `accentFor()`,
  expense status read from `e.avb`). `scholars-data.js` is treated as the source
  of truth and must not be modified to match the template — adapt the template.
- **Security note:** the `password: 'ngs2026'` in `scholars-data.js` is
  **cosmetic only**. The file is a public static asset — anyone can read it and
  the data directly. Do not treat this as real access control (see ROADMAP #1).

## Scholar data — single source of truth

All scholar facts live in `scholars-data.js` (`NGS_DATA`). The `card` and
`publicProfile` sub-objects drive the public pages; the full object drives the
navigator. Do not re-duplicate facts into HTML — update `scholars-data.js`.

## Working in this environment

- **Commits:** GPG signing fails here — commit with
  `git -c commit.gpgsign=false commit -m "..."`.
- **Push:** uses the owner's fine-grained PAT (Contents: write). The token is
  NOT stored in the repo — never commit secrets. `git push origin main`.
- **GitHub Pages:** legacy build. After disruptive changes the Fastly CDN can
  lag or return `host_not_allowed` (renaming the repo once reset routing).
  Builds usually finish in seconds; confirm via the Pages API
  (`/repos/.../pages/builds/latest`) that the latest commit SHA is built.
- **Browser cache:** after a deploy, a normal reload often serves the old file.
  Tell the user to **hard-refresh** (Cmd/Ctrl+Shift+R).
- **Verifying behavior:** there's a headless Chromium available for real
  browser testing —
  `node` + `/opt/node22/lib/node_modules/playwright` (CommonJS `require`) +
  executablePath `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Used to
  confirm the navigator unlocks and renders with zero page errors.

## Conventions

- Match the existing inline style of each file (token-based CSS vars `--ngs-*`,
  Newsreader/Manrope/IBM Plex Mono fonts, navy + gold palette).
- Keep internal links relative (`index.html`, `claire.html`, `index.html#scholars`).
- Only commit/push when asked. Use `git -c commit.gpgsign=false`.
