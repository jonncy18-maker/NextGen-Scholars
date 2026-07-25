/** @type {import('next').NextConfig} */

// Security headers applied to every route.
//
// No Content-Security-Policy here on purpose. The app renders inline styles and
// two `dangerouslySetInnerHTML` blocks (the pre-paint theme script in
// app/layout.jsx and the narrative copy in ScholarProfile.jsx), so a useful CSP
// needs either nonces plumbed through those or 'unsafe-inline' — and the latter
// buys almost nothing. Adding one properly is its own change.
const securityHeaders = [
  // Don't let the browser sniff a response into a different type than we sent.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Clickjacking: nothing here is meant to be framed. frame-ancestors would be
  // the modern spelling, but that lives in CSP, which we don't set yet.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Don't leak scholar-scoped paths (e.g. /home/claire) to third parties.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The app asks for none of these; deny by default.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Vercel serves this domain over HTTPS only. Two years, subdomains included.
  // Deliberately NOT preloaded — preload is a one-way door for the apex domain
  // and is the domain owner's call, not a config default.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
