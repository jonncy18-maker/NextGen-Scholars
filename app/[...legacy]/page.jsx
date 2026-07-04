'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

// useSearchParams() requires the route to opt out of static generation
// (or be wrapped in Suspense) — this route redirects immediately and has
// no meaningful static shell, so force-dynamic is the simpler choice.
export const dynamic = 'force-dynamic';

// Maps legacy MPA URLs (e.g. /navigator.html, /claire-home.html?scholar=claire)
// onto the SPA routes, and catches any other unrecognised path. Anything
// unrecognised falls back to the homepage so a stale bookmark or mistyped path
// can never render a blank screen.
const LEGACY_PATHS = {
  '/index.html': '/',
  '/claire.html': '/claire',
  '/april.html': '/april',
  '/janndilyne.html': '/janndilyne',
  '/navigator.html': '/navigator',
  '/entry.html': '/entry',
  '/claire-home.html': '/home/claire',
  '/april-home.html': '/home/april',
};

export default function LegacyRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const lower = pathname.toLowerCase();
    const search = searchParams.toString();
    const suffix = search ? `?${search}` : '';

    if (LEGACY_PATHS[lower]) {
      router.replace(`${LEGACY_PATHS[lower]}${suffix}`);
      return;
    }

    if (lower === '/english.html' || lower === '/grades.html') {
      const scholar = searchParams.get('scholar') || 'claire';
      const base = lower === '/english.html' ? '/english' : '/grades';
      router.replace(`${base}/${scholar}`);
      return;
    }

    router.replace('/');
  }, [pathname, searchParams, router]);

  return null;
}
