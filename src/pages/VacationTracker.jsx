import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { NGS_DATA } from '../../scholars-data.js';
import { PublicAskWidget } from '../components/PublicAskWidget.jsx';
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
  const [name,    setName]    = useState(fallback.name);
  const [travels, setTravels] = useState(null);

  useEffect(() => {
    sessionStorage.setItem('ngs_auth_scholar', scholarKey);
  }, [scholarKey]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('scholars').select('first_name').eq('scholar_key', scholarKey).limit(1),
      supabase.from('travels').select('*').eq('scholar', scholarKey).order('id', { ascending: true }),
    ]).then(([scholarRes, travelRes]) => {
      if (cancelled) return;
      const fn = scholarRes.data?.[0]?.first_name;
      if (fn) setName(fn);
      setTravels(travelRes.data ?? []);
    }).catch(() => { if (!cancelled) setTravels([]); });
    return () => { cancelled = true; };
  }, [scholarKey]);

  const trips        = travels ?? [];
  const completed    = trips.filter(t => t.state === 'done');
  const upcoming     = trips.filter(t => t.state !== 'done');
  const nextTrip     = upcoming[0] || null;
  const investedPhp  = trips.reduce((s, t) => s + (Number(t.amount_php) || 0), 0);

  return (
    <div className="sp-page">
      <div className="sp">
        <header className="sp-head">
          <div className="sp-track">
            <span className="sp-track-dot" />
            NextGen Nurses
            <span className="sp-track-sep">·</span>
            NGN
          </div>
          <p className="sp-greet-kicker">{name}</p>
          <h1 className="sp-greet-name">Worlds<br/>opened.</h1>
          <div className="sp-head-rule" />
          <div className="sp-head-meta">
            <span className="sp-stage">Vacation Tracker</span>
            <Link to={fallback.homeHref} className="sp-tagline" style={{ textDecoration: 'none' }}>
              ← Back to home
            </Link>
          </div>
        </header>

        <section className="sp-section">
          {/* Summary card */}
          <div className="vt-summary">
            {travels === null ? (
              <div className="vt-loading">Loading…</div>
            ) : (
              <div className="vt-summary-grid">
                <div className="vt-stat">
                  <div className="vt-stat-val">{completed.length}</div>
                  <div className="vt-stat-label">Trips taken</div>
                </div>
                <div className="vt-stat">
                  <div className="vt-stat-val">{fmtPhp(investedPhp)}</div>
                  <div className="vt-stat-label">Travel invested</div>
                </div>
                <div className="vt-stat">
                  <div className="vt-stat-val vt-stat-val--sm">
                    {nextTrip ? `${destEmoji(nextTrip.dest)} ${nextTrip.dest}` : '—'}
                  </div>
                  <div className="vt-stat-label">Next destination</div>
                </div>
              </div>
            )}
          </div>

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

          {travels !== null && trips.length === 0 && (
            <div className="vt-empty">
              No reward trips logged yet. Your mentor adds destinations as
              milestones are reached.
            </div>
          )}
        </section>

        <PublicAskWidget />

        <footer className="sp-footer">
          <div className="sp-mark">NGS</div>
          <div className="sp-footer-tag">One generation lifts another.</div>
          <Link to="/" className="sp-home-link">← Home</Link>
        </footer>
      </div>
    </div>
  );
}
