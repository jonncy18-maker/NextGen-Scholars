import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../lib/api.js';
import { ScholarAuthGate } from '../components/ScholarAuthGate.jsx';
import { SignOutButton } from '../components/SignOutButton.jsx';
import { PublicAskWidget } from '../components/PublicAskWidget.jsx';
import '../styles/vacation-tracker.css';

// Milestone states mirror the travels table: done (unlocked), booked, planned.
export const MS_STATES = {
  done:    { label: 'Unlocked', badge: '✓', cls: 'is-done'    },
  booked:  { label: 'Booked',   badge: '◆', cls: 'is-booked'  },
  planned: { label: 'Planned',  badge: '○', cls: 'is-planned' },
};

const FALLBACK = {
  claire:     { name: 'Claire',     homeHref: '/home/claire' },
  april:      { name: 'April',      homeHref: '/home/april' },
  janndilyne: { name: 'Janndilyne', homeHref: '/home/janndilyne' },
};

// A loose emoji map so each milestone gets a sense of what it is. Falls back to
// a target when nothing matches.
const NAME_EMOJI = [
  [/phone|smartphone|mobile/i, '📱'], [/laptop|computer|pc/i, '💻'],
  [/tablet|ipad/i, '📲'], [/bike|bicycle/i, '🚲'], [/motor|scooter/i, '🏍'],
  [/watch/i, '⌚'], [/camera/i, '📷'], [/desk|chair|furniture/i, '🪑'],
  [/internet|wifi|router/i, '📶'], [/printer/i, '🖨'], [/medical|equipment/i, '🩺'],
];

function nameEmoji(name) {
  if (!name) return '🎯';
  const hit = NAME_EMOJI.find(([re]) => re.test(name));
  return hit ? hit[1] : '🎯';
}

function fmtPhp(n) {
  if (!n) return '₱0';
  return '₱' + Math.round(n).toLocaleString('en-US');
}

export function MilestonesTracker({ scholarKey }) {
  const fallback = FALLBACK[scholarKey] || FALLBACK.claire;
  const [authed,     setAuthed]     = useState(false);
  const [name,       setName]       = useState(fallback.name);
  const [milestones, setMilestones] = useState(null);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    api.get('/bootstrap?tables=scholars,milestones').then(data => {
      if (cancelled) return;
      const fn = data.scholars?.[0]?.first_name;
      if (fn) setName(fn);
      setMilestones((data.milestones ?? []).slice().sort((a, b) => a.id - b.id));
    }).catch(() => { if (!cancelled) setMilestones([]); });
    return () => { cancelled = true; };
  }, [scholarKey, authed]);

  if (!authed) {
    return <ScholarAuthGate scholarKey={scholarKey} name={fallback.name} onUnlock={() => setAuthed(true)} />;
  }

  const items       = milestones ?? [];
  const unlocked    = items.filter(m => m.state === 'done');
  const upcoming    = items.filter(m => m.state !== 'done');
  const next        = upcoming[0] || null;
  const investedPhp = items.reduce((s, m) => s + (Number(m.amount_php) || 0), 0);

  return (
    <div className="sp-page">
      <div className="sp">
        <header className="sp-head">
          <SignOutButton onSignOut={() => setAuthed(false)} />
          <div className="sp-track">
            <span className="sp-track-dot" />
            NextGen Scholars
            <span className="sp-track-sep">·</span>
            Rewards
          </div>
          <p className="sp-greet-kicker">{name}</p>
          <h1 className="sp-greet-name">Tools<br/>to rise.</h1>
          <div className="sp-head-rule" />
          <div className="sp-head-meta">
            <span className="sp-stage">Milestones Tracker</span>
            <Link href={fallback.homeHref} className="sp-tagline" style={{ textDecoration: 'none' }}>
              ← Back to home
            </Link>
          </div>
        </header>

        <section className="sp-section">
          {/* Summary card */}
          <div className="vt-summary">
            {milestones === null ? (
              <div className="vt-loading">Loading…</div>
            ) : (
              <div className="vt-summary-grid">
                <div className="vt-stat">
                  <div className="vt-stat-val">{unlocked.length}</div>
                  <div className="vt-stat-label">Unlocked</div>
                </div>
                <div className="vt-stat">
                  <div className="vt-stat-val">{fmtPhp(investedPhp)}</div>
                  <div className="vt-stat-label">Invested</div>
                </div>
                <div className="vt-stat">
                  <div className="vt-stat-val vt-stat-val--sm">
                    {next ? `${nameEmoji(next.name)} ${next.name}` : '—'}
                  </div>
                  <div className="vt-stat-label">Next milestone</div>
                </div>
              </div>
            )}
          </div>

          <p className="vt-intro">
            Devices and infrastructure unlocked as academic targets are hit —
            every reward a step toward standing on your own.
          </p>

          {/* Timeline */}
          {milestones !== null && items.length > 0 && (
            <div className="vt-timeline">
              {items.map((m, i) => {
                const meta   = MS_STATES[m.state] || MS_STATES.planned;
                const isLast = i === items.length - 1;
                const amt    = Number(m.amount_php) || 0;
                return (
                  <div key={m.id} className={`vt-trip ${meta.cls}`}>
                    <div className="vt-trip-rail">
                      <div className="vt-trip-badge">
                        {m.state === 'done' ? '✓' : nameEmoji(m.name)}
                      </div>
                      {!isLast && <div className="vt-trip-connector" />}
                    </div>
                    <div className="vt-trip-body">
                      <div className="vt-trip-head">
                        <span className="vt-trip-dest">{m.name}</span>
                        <span className={`vt-trip-pill ${meta.cls}`}>{meta.label}</span>
                      </div>
                      <div className="vt-trip-meta">
                        {m.sem && <span className="vt-trip-sem">{m.sem}</span>}
                        {amt > 0 && <span className="vt-trip-amt">{fmtPhp(amt)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {milestones !== null && items.length === 0 && (
            <div className="vt-empty">
              No milestones logged yet. Your mentor adds rewards as academic
              targets are reached.
            </div>
          )}
        </section>

        <PublicAskWidget />

        <footer className="sp-footer">
          <div className="sp-mark">NGS</div>
          <div className="sp-footer-tag">One generation lifts another.</div>
          <Link href="/" className="sp-home-link">← Home</Link>
        </footer>
      </div>
    </div>
  );
}
