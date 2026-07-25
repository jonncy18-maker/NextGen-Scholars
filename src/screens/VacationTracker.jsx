import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { ScholarAuthGate } from '../components/ScholarAuthGate.jsx';
import { ScholarShell } from '../components/ScholarShell.jsx';
import { PublicAskWidget } from '../components/PublicAskWidget.jsx';
import { useSessionExpired } from '../hooks/useSessionExpired.js';
import '../styles/vacation-tracker.css';

// State metadata for a single reward trip. The travels table stores one of
// three states: done (taken), booked (confirmed, upcoming), planned (intended).
export const TRIP_STATES = {
  done:    { label: 'Completed', badge: '✓', cls: 'is-done'    },
  booked:  { label: 'Booked',    badge: '✈', cls: 'is-booked'  },
  planned: { label: 'Planned',   badge: '○', cls: 'is-planned' },
};

const FALLBACK = {
  claire:     { name: 'Claire',     homeHref: '/home/claire' },
  april:      { name: 'April',      homeHref: '/home/april' },
  janndilyne: { name: 'Janndilyne', homeHref: '/home/janndilyne' },
};

// A loose emoji map so each destination gets a sense of place. Falls back to
// the trip-state badge when nothing matches.
const DEST_EMOJI = [
  [/cebu/i, '🏝'], [/boracay/i, '🌊'], [/bohol/i, '🏖'],
  [/hong ?kong/i, '🌆'], [/cruise/i, '🚢'], [/taiwan/i, '🚢'],
  [/manila|visa/i, '🛂'], [/u\.?s\.?|united states|america|immersion/i, '✈'],
  [/japan|tokyo/i, '🗼'], [/korea|seoul/i, '🏙'], [/singapore/i, '🌃'],
];

function destEmoji(dest) {
  if (!dest) return '📍';
  const hit = DEST_EMOJI.find(([re]) => re.test(dest));
  return hit ? hit[1] : '📍';
}

function fmtPhp(n) {
  if (!n) return '₱0';
  return '₱' + Math.round(n).toLocaleString('en-US');
}

export function VacationTracker({ scholarKey }) {
  const fallback = FALLBACK[scholarKey] || FALLBACK.claire;
  const [authed,  setAuthed]  = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [name,    setName]    = useState(fallback.name);
  const [travels, setTravels] = useState(null);

  useSessionExpired(() => {
    if (!authed) return;
    setSessionExpired(true);
    setAuthed(false);
    setTravels(null);
  });

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    api.get('/bootstrap?tables=scholars,travels').then(data => {
      if (cancelled) return;
      const fn = data.scholars?.[0]?.first_name;
      if (fn) setName(fn);
      setTravels((data.travels ?? []).slice().sort((a, b) => a.id - b.id));
    }).catch(() => { if (!cancelled) setTravels([]); });
    return () => { cancelled = true; };
  }, [scholarKey, authed]);

  if (!authed) {
    return (
      <ScholarAuthGate
        scholarKey={scholarKey}
        name={fallback.name}
        onUnlock={() => { setSessionExpired(false); setAuthed(true); }}
        sessionExpired={sessionExpired}
      />
    );
  }

  const trips        = travels ?? [];
  const completed    = trips.filter(t => t.state === 'done');
  const upcoming     = trips.filter(t => t.state !== 'done');
  const nextTrip     = upcoming[0] || null;
  const investedPhp  = trips.reduce((s, t) => s + (Number(t.amount_php) || 0), 0);

  return (
    <ScholarShell
      scholarKey={scholarKey}
      name={name}
      active="travel"
      eyebrow="Reward Travel"
      title="Travel"
      subtitle="Worlds opened."
      identityRole="Vacation Tracker"
      onSignOut={() => { setSessionExpired(false); setAuthed(false); }}
    >
      <div className="ds-hero ds-hero--auto">
        <div className="ds-card ds-card--accent">
          <div className="ds-stat-label">Trips Taken</div>
          <div className="ds-stat-val">
            {travels === null ? '—' : completed.length}
          </div>
          <div className="ds-stat-sub">
            {travels === null
              ? 'Loading…'
              : `of ${trips.length} destination${trips.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div className="ds-card">
          <div className="ds-stat-label">Travel Invested</div>
          <div className="ds-stat-val">
            {travels === null ? '—' : fmtPhp(investedPhp)}
          </div>
          <div className="ds-stat-sub">across all trips</div>
        </div>
        <div className="ds-card">
          <div className="ds-stat-label">Next Destination</div>
          <div className="ds-stat-val vt-next-val">
            {nextTrip ? `${destEmoji(nextTrip.dest)} ${nextTrip.dest}` : '—'}
          </div>
          <div className="ds-stat-sub">
            {nextTrip?.sem ? `expected ${nextTrip.sem}` : 'nothing planned'}
          </div>
        </div>
      </div>

      <div className="ds-sec">
        <span className="ds-sec-title">Your Trips</span>
      </div>

      <section>
        <p className="vt-intro">
          Annual reward trips that scale with each milestone — every destination
          a deliberate widening of horizons.
        </p>

        {/* Timeline */}
        {travels !== null && trips.length > 0 && (
          <div className="vt-timeline">
            {trips.map((t, i) => {
              const meta   = TRIP_STATES[t.state] || TRIP_STATES.planned;
              const isLast = i === trips.length - 1;
              const amt    = Number(t.amount_php) || 0;
              return (
                <div key={t.id} className={`vt-trip ${meta.cls}`}>
                  <div className="vt-trip-rail">
                    <div className="vt-trip-badge">
                      {t.state === 'done' ? '✓' : destEmoji(t.dest)}
                    </div>
                    {!isLast && <div className="vt-trip-connector" />}
                  </div>
                  <div className="vt-trip-body">
                    <div className="vt-trip-head">
                      <span className="vt-trip-dest">{t.dest}</span>
                      <span className={`vt-trip-pill ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <div className="vt-trip-meta">
                      {t.sem && <span className="vt-trip-sem">{t.sem}</span>}
                      {amt > 0 && <span className="vt-trip-amt">{fmtPhp(amt)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {travels === null && <div className="vt-loading">Loading…</div>}

        {travels !== null && trips.length === 0 && (
          <div className="vt-empty">
            No reward trips logged yet. Your mentor adds destinations as
            milestones are reached.
          </div>
        )}
      </section>

      <PublicAskWidget />
    </ScholarShell>
  );
}
