'use client';

import { useEffect } from 'react';

// The browser can restore an entire page — including whatever data was
// already sitting in React state — from its back/forward cache (bfcache)
// with *zero* network activity, e.g. after navigating away and back, or
// sometimes just switching tabs. For pages showing live per-user data (a
// scholar's dashboard, expenses, grades...) that can mean a completely
// different user's already-fetched numbers get silently replayed instead
// of a fresh, re-authenticated load.
//
// This has to live at the root layout, not inside an auth-gated component
// (e.g. ScholarAuthGate) — a listener attached there gets torn down the
// moment that component unmounts (i.e. exactly once a scholar unlocks
// their dashboard), so it would already be gone in any bfcache snapshot
// taken after that point. Mounted once here, it persists for the whole
// app regardless of what's currently showing.
export function BfcacheReload() {
  useEffect(() => {
    function handlePageShow(e) {
      if (e.persisted) window.location.reload();
    }
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  return null;
}
