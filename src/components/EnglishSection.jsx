import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext.jsx';
import { api } from '../lib/api.js';
import { NAMECLASS } from '../constants.js';

const IMMERSION_URL = 'https://next-gen-immersion.vercel.app/';

function StatusBadge({ status }) {
  const labels = { good: 'On Track', warning: 'Slightly Behind', risk: 'At Risk' };
  return <span className={`enp-status-badge enp-status-${status}`}>{labels[status]}</span>;
}

// ── Overview card — live hours from Immersion, click through to it ────────────

function ScholarOverviewCard({ sk, immersion }) {
  const { D } = useData();
  const name = D.scholars[sk]?.firstName || sk;
  const nc   = NAMECLASS[sk] || '';

  if (!immersion) {
    return (
      <a className="enp-overview-card" href={IMMERSION_URL} target="_blank" rel="noopener noreferrer">
        <div className="enp-ov-header"><span className={`enp-ov-name ${nc}`}>{name}</span></div>
        <div className="enp-ov-pct">No Immersion account linked yet</div>
        <div className="enp-ov-cta">Open Immersion ↗</div>
      </a>
    );
  }

  const { currentHours, targetHours, status } = immersion;
  const pct = targetHours ? Math.min(100, (currentHours / targetHours) * 100) : null;

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
      <div className="enp-ov-stats">
        <span className="enp-ov-hours">{currentHours.toFixed(1)}h</span>
        {targetHours != null && <span className="enp-ov-goal">/ {targetHours}h</span>}
      </div>
      {pct != null && (
        <div className="enp-ov-bar-track">
          <div className={`enp-ov-bar-fill enp-ov-bar-fill--${status}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="enp-ov-pct">{pct != null ? `${pct.toFixed(0)}%` : 'No target set'}</div>
      <div className="enp-ov-cta">Open Immersion ↗</div>
    </a>
  );
}

// ── Section ────────────────────────────────────────────────────────────────────
//
// Read-only summary, live from the NextGen Immersion app (a separate app,
// separate Neon project) via GET /api/immersion-hours — not from this app's
// own english_periods/english_sessions tables, which nothing writes to
// anymore since mentor editing was removed here. Clicking a scholar's card
// opens Immersion directly.
export function EnglishSection({ id, collapsed, onToggle }) {
  const { D, scholarKeys } = useData();
  // TESDA-track scholars have no English-hours program (and no Immersion account).
  const englishKeys = scholarKeys.filter(sk => D.scholars[sk]?.track !== 'TESDA');
  const [immersion, setImmersion] = useState({});

  useEffect(() => {
    api.get('/immersion-hours').then(data => setImmersion(data || {})).catch(() => setImmersion({}));
  }, []);

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
            <span className="section-note">Live from Immersion · click a scholar to open it</span>
          </div>
          <div className="enp-overview-grid">
            {englishKeys.map(sk => (
              <ScholarOverviewCard key={sk} sk={sk} immersion={immersion[sk]} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
