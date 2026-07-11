'use client';

import { useEffect } from 'react';

// Registers the PWA service worker (public/sw.js). Lives in the root layout
// so registration happens once per page load regardless of route. Skipped in
// dev — a SW controlling localhost:3000 makes dev-server HMR and stale-asset
// debugging miserable, and next dev doesn't serve hashed static assets.
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Registration failure just means no offline/install support —
      // the app itself works fine without it.
    });
  }, []);

  return null;
}
