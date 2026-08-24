import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { ScholarAuthGate } from '../components/ScholarAuthGate.jsx';
import { ScholarShell } from '../components/ScholarShell.jsx';
import { PublicAskWidget } from '../components/PublicAskWidget.jsx';
import { useSessionExpired } from '../hooks/useSessionExpired.js';
import '../styles/vacation-tracker.css';

// Milestone states mirror the travels table: done (unlocked), booked, planned.
export const MS_STATES = {
  done: { label: 'Unlocked', badge: '✓', cls: 'is-done' },
  booked: { label: 'Booked', badge: '◆', cls: 'is-booked' },
  planned: { label: 'Planned', badge: '○', cls: 'is-planned' },
};

const FALLBACK = {
  claire: { name: 'Claire', homeHref: '/home/claire' },
  april: { name: 'April', homeHref: '/home/april' },
  janndilyne: { name: 'Janndilyne', homeHref: '/home/janndilyne' },
  // Test account (jbshaw.cpa@gmail.com, scholar_key='demo' — see CLAUDE.md).
  demo: { name: 'John', homeHref: '/home/demo' },
};

// A loose emoji map so each milestone gets a sense of what it is. Falls back to
// a target when nothing matches.
const NAME_EMOJI = [
  [/phone|smartphone|mobile/i, '📱'],
  [/laptop|computer|pc/i, '💻'],
  [/tablet|ipad/i, '📲'],
  [/bike|bicycle/i, '🚲'],
  [/motor|scooter/i, '🏍'],
  [/watch/i, '⌚'],
  [/camera/i, '📷'],
  [/desk|chair|furniture/i, '🪑'],
  [/internet|wifi|router/i, '📶'],
  [/printer/i, '🖨'],
  [/medical|equipment/i, '🩺'],
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
  const [authed, setAuthed] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [name, setName] = useState(fallback.name);
  const [milestones, setMilestones] = useState(null);

  useSessionExpired(() => {
    if (!authed) return;
    setSessionExpired(true);
    setAuthed(false);
    setMilestones(null);
  });

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    api
      .get('/bootstrap?tables=scholars,milestones')
      .then((data) => {
        if (cancelled) return;
        const fn = data.scholars?.[0]?.first_name;
        if (fn) setName(fn);
        setMilestones((data.milestones ?? []).slice().sort((a, b) => a.id - b.id));
      })
      .catch(() => {
        if (!cancelled) setMilestones([]);
      });
    return () => {
      cancelled = true;
    };
  }, [scholarKey, authed]);

  if (!authed) {
    return (
      <ScholarAuthGate
        scholarKey={scholarKey}
        name={fallback.name}
        onUnlock={() => {
          setSessionExpired(false);
          setAuthed(true);
        }}
        sessionExpired={sessionExpired}
      />
    );
  }

  const items = milestones ?? [];
  const unlocked = items.filter((m) => m.state === 'done');
  const upcoming = items.filter((m) => m.state !== 'done');
  const next = upcoming[0] || null;
  const investedPhp = items.reduce((s, m) => s + (Number(m.amount_php) || 0), 0);

  return (
    <ScholarShell
      scholarKey={scholarKey}
      name={name}
      active="milestones"
      eyebrow="Rewards"
      title="Milestones"
      subtitle="Tools to rise."
      identityRole="Milestones Tracker"
      onSignOut={() => {
        setSessionExpired(false);
        setAuthed(false);
      }}
    >
      {/* Stat cards — the shell's own ds-card/ds-stat-* primitives, so these
          theme with the rest of the dashboard instead of the old navy
          summary card's hardcoded light-only surface. */}
      <div className="ds-hero ds-hero--auto">
        <div className="ds-card ds-card--accent">
          <div className="ds-stat-label">Unlocked</div>
          <div className="ds-stat-val">{milestones === null ? '—' : unlocked.length}</div>
          <div className="ds-stat-sub">
            {milestones === null
              ? 'Loading…'
              : `of ${items.length} milestone${items.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div className="ds-card">
          <div className="ds-stat-label">Invested</div>
          <div className="ds-stat-val">{milestones === null ? '—' : fmtPhp(investedPhp)}</div>
          <div className="ds-stat-sub">across all rewards</div>
        </div>
        <div className="ds-card">
          <div className="ds-stat-label">Next Milestone</div>
          <div className="ds-stat-val vt-next-val">
            {next ? `${nameEmoji(next.name)} ${next.name}` : '—'}
          </div>
          <div className="ds-stat-sub">
            {next?.sem ? `expected ${next.sem}` : 'nothing pending'}
          </div>
        </div>
      </div>

      <div className="ds-sec">
        <span className="ds-sec-title">Your Rewards</span>
      </div>

      <section>
        <p className="vt-intro">
          Devices and infrastructure unlocked as academic targets are hit — every reward a step
          toward standing on your own.
        </p>

        {/* Timeline */}
        {milestones !== null && items.length > 0 && (
          <div className="vt-timeline">
            {items.map((m, i) => {
              const meta = MS_STATES[m.state] || MS_STATES.planned;
              const isLast = i === items.length - 1;
              const amt = Number(m.amount_php) || 0;
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

        {milestones === null && <div className="vt-loading">Loading…</div>}

        {milestones !== null && items.length === 0 && (
          <div className="vt-empty">
            No milestones logged yet. Your mentor adds rewards as academic targets are reached.
          </div>
        )}
      </section>

      <PublicAskWidget />
    </ScholarShell>
  );
}
