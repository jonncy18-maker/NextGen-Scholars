import { useEffect } from 'react';
import { onSessionExpired } from '../lib/api.js';

// Subscribes to api.js's central "this call got a 401 that didn't recover"
// broadcast for the lifetime of the calling component. Every screen with an
// auth gate (Navigator, ScholarHome, EnglishTracking, GradeEntry,
// VacationTracker, MilestonesTracker) wires this to re-lock instead of
// silently continuing to render whatever it loaded before the session died.
export function useSessionExpired(onExpire) {
  useEffect(() => onSessionExpired(onExpire), [onExpire]);
}
