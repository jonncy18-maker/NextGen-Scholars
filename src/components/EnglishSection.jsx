import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../context/DataContext.jsx';
import { api } from '../lib/api.js';
import { NAMECLASS, SESSION_TYPES } from '../constants.js';

const IMMERSION_URL = 'https://next-gen-immersion.vercel.app/';

function todayStr() { return new Date().toISOString().slice(0, 10); }

function activePeriod(periods) {
  if (!periods?.length) return null;
  const t = todayStr();
  return periods.find(p => p.start_date <= t && p.end_date >= t)
    ?? periods.slice().sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
}

function periodElapsedFraction(startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00');
  const end   = new Date(endDate   + 'T00:00:00');
  const now   = new Date();
  const total = Math.max(1, (end - start) / 86400000);
  const elapsed = Math.min(total, Math.max(0, (now - start) / 86400000));
  return elapsed / total;
}

function getStatus(actual, expected) {
  if (!expected || expected === 0) return 'good';
  const ratio = actual / expected;
  if (ratio >= 0.9) return 'good';
  if (ratio >= 0.7) return 'warning';
  return 'risk';
}

function StatusBadge({ status }) {
  const labels = { good: 'On Track', warning: 'Slightly Behind', risk: 'At Risk' };
  return <span className={`enp-status-badge enp-status-${status}`}>{labels[status]}</span>;
}

// ── Overview card — read-only summary, click through to Immersion ─────────────

function ScholarOverviewCard({ sk, periods, sessions }) {
  const { D } = useData();
  const name  = D.scholars[sk]?.firstName || sk;
  const nc    = NAMECLASS[sk] || '';

  const active   = activePeriod(periods);
  const filtered = active
    ? sessions.filter(s => s.date >= active.start_date && s.date <= active.end_date)
    : sessions;

  const totalHours = filtered.reduce((s, r) => s + (r.duration_minutes || 0) / 60, 0);
  const goal       = active ? Number(active.hour_goal) : null;
  const pct        = goal ? Math.min(100, (totalHours / goal) * 100) : null;
  const elapsed    = active ? periodElapsedFraction(active.start_date, active.end_date) : 0;
  const expected   = goal ? goal * elapsed : null;
  const status     = getStatus(totalHours, expected ?? 0);

  const sessionLabel = active
    ? (SESSION_TYPES.find(t => t.key === active.session_type)?.label ?? active.label)
    : null;

  return (
    <a
      className={`enp-overview-card enp-overview-card--${status}`}
      href={IMMERSION_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="enp-ov-header">
        <span className={`enp-ov-name ${nc}`}>{name}</span>
        <StatusBadge status={status} />
      </div>
      {sessionLabel && (
        <div className="enp-ov-session">{sessionLabel}</div>
      )}
      <div className="enp-ov-stats">
        <span className="enp-ov-hours">{totalHours.toFixed(1)}h</span>
        {goal && <span className="enp-ov-goal">/ {goal}h</span>}
      </div>
      {pct != null && (
        <div className="enp-ov-bar-track">
          <div className={`enp-ov-bar-fill enp-ov-bar-fill--${status}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="enp-ov-pct">{pct != null ? `${pct.toFixed(0)}%` : 'No session set'}</div>
      <div className="enp-ov-cta">Open Immersion ↗</div>
    </a>
  );
}

// ── Section ────────────────────────────────────────────────────────────────────
//
// Read-only summary only — no period/session editing here. Hours are logged
// in the separate NextGen Immersion app; clicking a scholar's card opens it.
export function EnglishSection({ id, collapsed, onToggle }) {
  const { D, scholarKeys } = useData();
  // TESDA-track scholars have no English-hours program — exclude them.
  const englishKeys = scholarKeys.filter(sk => D.scholars[sk]?.track !== 'TESDA');
  const [periods,  setPeriods]  = useState([]);
  const [sessions, setSessions] = useState([]);

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([
      api.get('/english/periods'),
      api.get('/english/sessions'),
    ]);
    setPeriods(p || []);
    setSessions(s || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        English
        <span className="eyebrow-rule" />
        <button className="section-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="enp-body">
          <div className="section-head">
            <h2 className="section-title">English Hours</h2>
            <span className="section-note">Click a scholar to open the Immersion tracker</span>
          </div>
          <div className="enp-overview-grid">
            {englishKeys.map(sk => (
              <ScholarOverviewCard
                key={sk} sk={sk}
                periods={periods.filter(p => p.scholar === sk)}
                sessions={sessions.filter(s => s.scholar === sk)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
