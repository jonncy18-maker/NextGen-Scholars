import { useEffect, useState, useCallback, useRef } from 'react';

// PWA update control. public/sw.js already auto-activates a new service
// worker as soon as it installs (self.skipWaiting() + clients.claim()) — the
// gap is that browsers only re-check sw.js for changes occasionally (mainly
// on navigation, at most every ~24h), so an installed/standalone window can
// sit on stale code until something forces that check. This hook exposes a
// manual "check now" (used by the dedicated update button, which force-
// reloads once the check completes) plus a silent variant (used by data-
// refresh buttons, so a mentor/scholar who only ever clicks "refresh" still
// gets deployment freshness without an unexpected reload every time) and
// passive detection of an update that already installed in the background.
export function useAppUpdate() {
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(false);
  // Guards against reloading twice if 'controllerchange' fires more than
  // once (it shouldn't, but browsers have shipped that bug before).
  const reloadedRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let cancelled = false;

    // The new worker's skipWaiting()+clients.claim() makes it take control
    // as soon as it activates — reload once that actually happens instead of
    // racing a reload immediately after reg.update() (which can land before
    // the new worker has finished installing/activating and still serve the
    // old cached shell).
    function onControllerChange() {
      if (reloadedRef.current) return;
      reloadedRef.current = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

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
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  // force=true (the dedicated "check for updates" button): always reloads
  // once the check completes, whether or not a new version was actually
  // found — matches its "tap to reload" tooltip/expectation.
  // force=false (silently piggy-backed on a plain data-refresh click): just
  // asks the browser to re-fetch sw.js; if that turns up a new version, the
  // controllerchange listener above reloads automatically once it's ready.
  // Nothing happens if there's nothing new, so a routine data refresh never
  // surprises anyone with an unrequested reload.
  const checkForUpdate = useCallback(async (opts) => {
    const force = opts?.force ?? true;
    if (!('serviceWorker' in navigator)) {
      if (force) window.location.reload();
      return;
    }
    if (force) setChecking(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      // Forces the browser to re-fetch sw.js; a changed script installs and
      // self-activates immediately (see public/sw.js), which triggers
      // 'controllerchange' above.
      if (reg) await reg.update();
    } catch {
      // offline or registration missing.
    } finally {
      if (force) {
        setChecking(false);
        window.location.reload();
      }
    }
  }, []);

  return { checking, available, checkForUpdate };
}
