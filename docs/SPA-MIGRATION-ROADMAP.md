# SPA Migration Roadmap

NextGen Scholars is being converted from a multi-page app (9 separate HTML entry
points) to a Single Page Application, with PWA support as the first step toward
a React Native mobile app.

## Why SPA

- **PWA requirement** — service workers and the install manifest assume a single
  app shell; MPA doesn't support this cleanly.
- **Shared auth state** — one session context across all routes instead of
  per-page sessionStorage checks and LockScreen components.
- **Path to React Native** — the routing patterns, auth context, and API hooks
  built here are mirrored in React Native. The Supabase backend is shared between
  the web PWA and the future mobile app.

## Architecture: before → after

| Before | After |
|--------|-------|
| 9 HTML entry points | 1 `index.html` shell |
| `window.location.href` navigation | `useNavigate()` / `<Link>` |
| Per-page LockScreen + sessionStorage | Shared `AuthContext` + `<ProtectedRoute>` |
| Vite MPA build (9 bundles) | Vite SPA build, code-split per route |
| No offline support | Service worker + manifest (PWA) |

## Route map

```
/                          → HomePage (public)
/navigator                 → Navigator dashboard (mentor only)
/scholar/claire            → Claire portal (claire or mentor)
/scholar/claire/profile    → Claire profile & academics
/scholar/claire/entry      → Expense entry for Claire
/scholar/april             → April portal (april or mentor)
/scholar/april/profile     → April profile & academics
/scholar/april/entry       → Expense entry for April
/english                   → English session tracking
/grades                    → Grade entry
```

All routes live under the `/NextGen-Scholars/` base (GitHub Pages). React
Router's `basename` prop handles this transparently.

---

## Phase 1 — React Router + single shell

**Goal:** one entry point, all pages reachable via client-side routing.

Tasks:
- Install `react-router` v7
- Collapse all 9 HTML files into one `index.html`
- Update `vite.config.js`: single entry, code-split per route
- Create `src/App.jsx` with `<BrowserRouter basename="/NextGen-Scholars">` and
  the full route tree
- Add `404.html` (GitHub Pages SPA redirect trick) so deep links and hard
  refreshes resolve correctly
- Delete orphaned HTML entry files

What doesn't change: all page components, all CSS, all Supabase wiring,
`DataContext`, `FxContext`.

---

## Phase 2 — Shared AuthContext

**Goal:** replace scattered per-page auth checks with a single role-aware context.

Tasks:
- Create `src/context/AuthContext.jsx` holding role (`mentor | claire | april | guest`)
  and Supabase session state
- Create `<ProtectedRoute roles={[...]} />` — redirects to `/` if role doesn't match
- Migrate `LockScreen` and `LoginModal` into a unified login flow that sets role
  and navigates to the appropriate route
- Remove `ngs_auth_scholar` sessionStorage usage (replaced by context)

---

## Phase 3 — Navigation cleanup

**Goal:** remove all hard HTML-file references from the codebase.

Tasks:
- Replace every `window.location.href = '*.html'` with `useNavigate()`
- Replace every `<a href="*.html">` with `<Link to="...">`
- Replace `?scholar=claire` query param pattern with `/scholar/claire/entry`
  route params (`useParams()`)

---

## Phase 4 — PWA

**Goal:** installable, offline-capable web app.

Tasks:
- Install `vite-plugin-pwa`
- Configure `manifest.json`:
  - `name`: NextGen Scholars
  - `background_color`: `#1B2A4A` (navy)
  - `theme_color`: `#C9A84C` (gold)
  - Icons at 192×192 and 512×512
- Configure service worker: precache all built assets, offline fallback to shell
- Add iOS-specific meta tags (`apple-mobile-web-app-capable`, status bar style)
- Test install prompt on Chrome (Android) and Safari (iOS)

**Note:** PWA is purely additive — `vite-plugin-pwa` layers onto the build
output. When React Native launches, web users keep the PWA; mobile users use
the native app. Both share the same Supabase backend. Nothing in Phase 4 needs
to be undone.

---

## Deployment notes

- GitHub Pages serves from `main`. Feature work happens on `claude/*` branches,
  merged via PR.
- After each phase, deploy to the branch and verify routes before merging.
- Hard-refresh (Cmd/Ctrl+Shift+R) required after deploys due to Fastly CDN lag.
- Phase 4 service worker caching strategy: use `StaleWhileRevalidate` for API
  calls and `CacheFirst` for static assets. Bump the service worker version on
  every release to force cache invalidation.

## What this unlocks

Once all four phases are done:
1. PWA installable on Android and iOS home screen
2. Offline read access to last-fetched scholar data
3. Clean URL structure ready to mirror in React Native Navigation
4. Single auth flow usable across web and (eventually) a shared auth SDK
