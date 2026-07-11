// Web app manifest (Next metadata route — served at /manifest.webmanifest and
// auto-linked in <head>). Colors come from the --ngs-* tokens in
// src/styles/tokens.css: navy-deep #131F38 (splash/background), navy #1B2A4A
// (theme / status bar).
export default function manifest() {
  return {
    name: 'NextGen Scholars',
    short_name: 'NGS',
    description: 'NextGen Scholars — mentorship program dashboards for scholars and mentors.',
    scope: '/',
    // start_url is only used when launched from the installed icon (PWA on the
    // home screen, and the eventual TWA/Play Store wrapper) — not for ordinary
    // browser visits to '/'. So the installed app opens straight on the login
    // screen for scholars, while the browser still serves the marketing home
    // page at '/'. Scope stays '/' so the rest of the app (incl. the home
    // page, reachable via login's "Back to NextGen Scholars" link) stays in scope.
    start_url: '/login',
    display: 'standalone',
    background_color: '#131F38',
    theme_color: '#1B2A4A',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
