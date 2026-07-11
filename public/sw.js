/* NextGen Scholars service worker.
 *
 * THE ONE RULE THAT MATTERS: /api/** is strictly network-only. This app
 * serves per-scholar data from those routes, and different scholars sign in
 * on the same device — a cached /api/bootstrap response served to the wrong
 * scholar is the exact bug class documented in CLAUDE.md ("scholar sees
 * another scholar's numbers"). When in doubt, cache less.
 *
 * Strategy:
 *   - /api/**            → network-only, never cached (not even as fallback)
 *   - navigations (HTML) → network-first; offline fallback to the cached
 *                          public homepage shell only
 *   - same-origin static assets (GET: /_next/static, /icons, images, fonts)
 *                        → cache-first (content-hashed or immutable files)
 *   - everything else    → straight to the network, untouched
 *
 * Bump CACHE_VERSION on breaking changes to the caching logic; old caches
 * are dropped on activate. /_next/static URLs are content-hashed per build,
 * so stale-JS-after-deploy resolves itself once the new HTML is fetched.
 */

const CACHE_VERSION = 'ngs-v1';
const SHELL_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        cache.addAll([
          SHELL_URL,
          '/icons/icon-192.png',
          '/icons/icon-512.png',
          '/icons/maskable-512.png',
        ])
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return url.pathname === '/api' || url.pathname.startsWith('/api/');
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only same-origin GETs are ever handled; API routes are never handled at
  // all — the browser talks to the network directly, exactly as without a SW.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;

  if (req.mode === 'navigate') {
    // Network-first. Cache successful navigations to PUBLIC pages only —
    // authed pages render their own client-side auth gates, but keeping them
    // out of the cache entirely is the conservative line.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && isPublicPath(url.pathname)) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((hit) => hit || caches.match(SHELL_URL))
            .then((hit) => hit || Response.error())
        )
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
            }
            return res;
          })
      )
    );
  }
  // Anything else falls through to the network untouched.
});

// Public, non-authed pages only — every scholar/mentor route stays uncached.
function isPublicPath(pathname) {
  return (
    pathname === '/' ||
    pathname === '/faq' ||
    pathname === '/claire' ||
    pathname === '/april' ||
    pathname === '/janndilyne'
  );
}
