import { useEffect, useState, useCallback } from 'react';

// PWA update control. public/sw.js already auto-activates a new service
// worker as soon as it installs (self.skipWaiting() + clients.claim()) — the
// gap is that browsers only re-check sw.js for changes occasionally (mainly
// on navigation, at most every ~24h), so an installed/standalone window can
// sit on stale code until something forces that check. This hook exposes a
// manual "check now" plus passive detection of an update that already
// installed in the background, for a topbar button in both dashboard shells.
export function useAppUpdate() {
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let cancelled = false;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg || cancelled) return;

      function watch(worker) {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          // 'installed' with an existing controller means this is a real
          // update (not the first-ever install) that's ready/active now.
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setAvailable(true);
          }
        });
      }
      watch(reg.installing);
      reg.addEventListener('updatefound', () => watch(reg.installing));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      window.location.reload();
      return;
    }
    setChecking(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      // Forces the browser to re-fetch sw.js; a changed script installs and
      // self-activates immediately (see public/sw.js), which the watcher
      // above picks up as `available`.
      if (reg) await reg.update();
    } catch {
      // offline or registration missing — reload still picks up whatever
      // the network-first navigation handler can get.
    } finally {
      setChecking(false);
      window.location.reload();
    }
  }, []);

  return { checking, available, checkForUpdate };
}
