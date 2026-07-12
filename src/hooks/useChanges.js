// One shared module-level poller per tab against /api/changes, replacing the
// 9 Supabase realtime channels that went inert once writes moved to Neon
// (they watched Supabase tables that stopped changing). Multiple components
// (Navigator, CareerSection, GradesSection) can each call useChanges() —
// they share a single interval/fetch cycle rather than one each.
//
// Design: ~25s interval, paused while the tab is hidden, an immediate poll on
// focus/visibility, and an immediate poll after any of this tab's own writes
// (via api.js's afterWrite() poke) so your own edits feel instant rather than
// waiting for the next tick. Delete reconciliation: the poller tracks each
// table's id set across polls and reports deletedIds alongside the server's
// changed-row payload, since a deleted row produces no "changed row" event by
// itself (it's just absent from /api/changes' `ids` array).
//
// A poll that 401s (dead session) is surfaced via api.js's onSessionExpired
// broadcast, same as every other call through that module — screens
// subscribe with useSessionExpired() rather than this hook needing its own
// auth-error channel.
import { useEffect, useRef } from 'react';
import { api, onAfterWrite } from '../lib/api.js';

const POLL_INTERVAL_MS = 25000;

let subscribers = new Set();
let since = null;
let prevIds = {};
let intervalId = null;
let inFlight = false;
let unsubAfterWrite = null;
let visibilityHandler = null;
let focusHandler = null;

function computeDeltas(tables) {
  const result = {};
  for (const [table, { rows, ids }] of Object.entries(tables)) {
    const idSet = new Set((ids || []).map(String));
    const prev = prevIds[table];
    const deletedIds = prev ? [...prev].filter(id => !idSet.has(id)) : [];
    prevIds[table] = idSet;
    result[table] = { rows: rows || [], deletedIds };
  }
  return result;
}

async function poll() {
  if (inFlight || (typeof document !== 'undefined' && document.hidden)) return;
  inFlight = true;
  try {
    const sinceParam = since || new Date(0).toISOString();
    const data = await api.get(`/changes?since=${encodeURIComponent(sinceParam)}`);
    since = data.now;
    const deltas = computeDeltas(data.tables);
    subscribers.forEach(cb => {
      try { cb(deltas); } catch (err) { console.error('useChanges subscriber error:', err); }
    });
  } catch (err) {
    console.warn('useChanges poll failed:', err.message);
  } finally {
    inFlight = false;
  }
}

function attachGlobalListenersIfNeeded() {
  if (intervalId) return;
  since = new Date().toISOString();
  prevIds = {};
  intervalId = setInterval(poll, POLL_INTERVAL_MS);
  visibilityHandler = () => { if (!document.hidden) poll(); };
  focusHandler = () => poll();
  document.addEventListener('visibilitychange', visibilityHandler);
  window.addEventListener('focus', focusHandler);
  unsubAfterWrite = onAfterWrite(poll);
}

function detachGlobalListenersIfIdle() {
  if (subscribers.size > 0) return;
  clearInterval(intervalId);
  intervalId = null;
  document.removeEventListener('visibilitychange', visibilityHandler);
  window.removeEventListener('focus', focusHandler);
  visibilityHandler = null;
  focusHandler = null;
  if (unsubAfterWrite) { unsubAfterWrite(); unsubAfterWrite = null; }
  since = null;
  prevIds = {};
}

// onChange receives { [table]: { rows, deletedIds } } for every polled table
// on every tick (empty arrays when nothing changed) — cheap to check.
export function useChanges(onChange) {
  const cbRef = useRef(onChange);
  useEffect(() => { cbRef.current = onChange; });

  useEffect(() => {
    const wrapped = deltas => cbRef.current(deltas);
    subscribers.add(wrapped);
    attachGlobalListenersIfNeeded();
    return () => {
      subscribers.delete(wrapped);
      detachGlobalListenersIfIdle();
    };
  }, []);
}
