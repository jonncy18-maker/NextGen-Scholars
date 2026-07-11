# PWA Foundation — Installable App Groundwork

**Status: SHIPPED (2026-07-11).** The PWA foundation described below is built:
`app/manifest.js` (manifest metadata route), `public/sw.js` (the minimal
hand-rolled service worker option — Serwist was skipped to avoid Next 14
compatibility friction), `public/icons/` (192/512 + maskable 512, gold-on-navy
NGS badge), and `src/components/RegisterSW.jsx` (registration, mounted in
`app/layout.jsx`, production-only). `/api/**` is strictly network-only and only
public pages (`/`, `/faq`, `/claire`, `/april`, `/janndilyne`) plus hashed
static assets are cached. The sections below remain as the design rationale
and verification checklist.

**Context:** This is the second app in the NGS native rollout. The pilot is
**NextGen-Immersion** — build and prove the PWA→TWA→Play pipeline there first
(see that repo's `docs/PWA.md` and `docs/PLAY-STORE.md`), then apply this doc
here. When ready to package for the Play Store, copy Immersion's
`docs/PLAY-STORE.md` into this repo and adapt the origin/package id.

The distribution decision for this app is **private, Play Internal Testing
track** (same as Immersion) — it's an internal mentorship tool, not public.

---

## What "PWA-ready" means (acceptance bar)

Passes Chrome DevTools → Lighthouse "Installable" with no errors; Chrome/Android
offers "Install app". Requires: a linked **web app manifest** (name,
short_name, start_url, display, theme_color, background_color, 192+512 icons and
a 512 maskable), a **service worker** controlling the page, HTTPS (Vercel
already), and a viewport meta (Next default covers it).

---

## This app's specifics (read before writing code)

- **Framework:** Next.js **14** App Router with **real file-based routes** (not
  a hash-router SPA like Immersion). Routes: `/`, `/login`, `/navigator/*`,
  `/home/:scholar`, `/english/:scholar`, `/grades/:scholar`, `/vacation/:scholar`,
  `/milestones/:scholar`, `/claire`, `/april`, `/janndilyne`, `/entry`. See
  `CLAUDE.md` → Routes.
- **`start_url` = `/`** (the public homepage). `scope` = `/` so the installed
  app can navigate the whole route tree. Real routes mean the SW can/should
  cache navigations (App Router server components) — more surface than
  Immersion's single shell.
- **Auth model differs from Immersion.** This app uses **JWKS-verified Bearer
  JWTs** per request (`src/lib/api.js` attaches a token via `getToken()`), not
  a session-cookie-only model. The SW must still treat **`/api/**` as
  network-only** — never cache authed API responses. `lib/http.js`'s `json()`
  already sends `Cache-Control: private, no-store`; the SW must honor that and
  not override it with its own cache.
- **Per-scholar data isolation.** Because different scholars sign into
  different `/home/:scholar` routes on possibly the same device, the SW must
  **never** cache `/api/bootstrap` or any scholar-scoped API response. Cache
  only static assets and (optionally) the public shell. Getting this wrong
  reintroduces the exact "scholar sees another scholar's numbers" class of bug
  documented in `CLAUDE.md`.

---

## Recommended approach: Serwist

`next-pwa` is effectively unmaintained. Use **Serwist** (`@serwist/next`) — but
note it targets modern Next; on **Next 14** confirm the installed Serwist
version supports 14 (or pin a compatible release). If Serwist/Next-14 friction
appears, the **minimal hand-rolled SW** (below) is a safe fallback here, since
this app's offline needs are modest (open the shell; the data is authed and
network-only anyway).

### Steps

1. Install Serwist (verify Next 14 compatibility) or use the hand-rolled SW.
2. Add the manifest as **`app/manifest.js`** (Next metadata route → served at
   `/manifest.webmanifest`, type-checked, single source) — preferred over a
   static file.
3. Add `themeColor` + `appleWebApp` to `app/layout.jsx`'s `metadata` export.
4. Service worker strategy: `NetworkOnly` for `/api/**`, `CacheFirst` for
   images/fonts/icons, `StaleWhileRevalidate` (or NetworkFirst) for document
   navigations. **Explicitly exclude every `/api/**` route from caching.**
5. Icons in `public/icons/` (see below).

### Manifest starter (adapt values — use the navy + gold `--ngs-*` palette)

```jsonc
{
  "name": "NextGen Scholars",
  "short_name": "NGS",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0f1b3d",   // navy — match --ngs-* tokens in src/styles/
  "theme_color": "#0f1b3d",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

> Pull the exact navy/gold hex from `src/styles/` token vars so the splash /
> status bar matches the app; the value above is a placeholder.

### Minimal hand-rolled alternative

Static `public/sw.js`: on `install` pre-cache the shell + icons; on `fetch`,
cache-first for same-origin static GETs, **network-only for `/api/**`**,
network-first for navigations. Register from a small client component in
`app/layout.jsx`. Version the cache name and clear old caches on `activate`.

---

## Icons

192, 512, and a **maskable** 512 (safe-zone padding). Source from the NGS
gold-on-navy badge. Generate via PWABuilder Image Generator or
`pwa-asset-generator`, drop in `public/icons/`, verify the maskable safe-circle
in DevTools → Application → Manifest.

---

## Verification checklist

- [ ] `npm run build && npm run start`, open in Chrome.
- [ ] DevTools → Application → Manifest: no errors, icons + maskable OK.
- [ ] Service worker registered, activated, controlling the page.
- [ ] Lighthouse / "Installability": installable, no PWA errors.
- [ ] "Install app" appears; installed app launches full-screen at `/`.
- [ ] Offline: app shell loads (public pages); authed pages correctly show a
      network error rather than stale cached data.
- [ ] **Multi-scholar isolation:** sign in as scholar A on a route, sign out,
      sign in as scholar B — confirm no scholar-A data is served from the SW
      cache. Watch the Network tab: `/api/bootstrap` must hit the network every
      time, never the SW cache.
- [ ] Mentor (Navigator) auth + polling (`useChanges`) still works inside the
      installed app.

---

## Gotchas

- **SW + per-scholar data = the danger zone.** The single biggest risk in this
  repo is the SW caching a scholar-scoped API response and serving it to a
  different scholar. Keep `/api/**` strictly network-only. When in doubt, cache
  less.
- **Stale JS after deploy.** Version cache names / rely on Serwist's build
  manifest; clean old caches on `activate`.
- **SPA-adjacent routes.** Unlike Immersion this app has no catch-all rewrite,
  but it does have `app/[...legacy]/page.jsx`. Confirm the manifest + SW URLs
  aren't shadowed by the legacy catch-all.
- **iOS is second-class** (scholars are on Android) — use `appleWebApp`
  metadata, don't assume manifest parity.

---

## Next step

After this passes, copy `docs/PLAY-STORE.md` from NextGen-Immersion into this
repo (adapt origin + a new stable package id, e.g.
`com.nextgenscholars.scholars`) and follow the TWA + Internal Testing rollout.
Do this **after** the Immersion pilot has proven the pipeline end-to-end.
