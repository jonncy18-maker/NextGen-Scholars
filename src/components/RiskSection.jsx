import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext.jsx';
import { api } from '../lib/api.js';
import { NAMECLASS } from '../constants.js';

// Weeks in a semester, used for budget burn-rate projection
const SEM_WEEKS = 16;

// ── Risk classification helpers ──────────────────────────────────────────────

function riskLevel(conditions) {
  // conditions: array of 'ok' | 'watch' | 'risk'
  if (conditions.includes('risk')) return 'risk';
  if (conditions.includes('watch')) return 'watch';
  return 'ok';
}

// `liveGpa` is the most-recent-semester GPA (as %) computed from grade_entries
// in navigator.jsx — the same source the portfolio and the Academics grade
// records screen use. Prefer it so the risk card never drifts from what the
// grade records show; fall back to the legacy `academics` table only when a
// scholar has no live grade_entries yet.
function gpaRisk(s, liveGpa) {
  const floor = s.gpaFloor ?? s.gpa_floor ?? 75;
  let gpa = liveGpa ?? null;
  if (gpa == null) {
    const records = (s.academics || []).filter((a) => a.gpa != null);
    gpa = records.length ? records[records.length - 1].gpa : null;
  }
  if (gpa == null) return { level: 'ok', gpa: null, floor };
  const level = gpa < floor ? 'risk' : gpa < floor + 2 ? 'watch' : 'ok';
  return { level, gpa, floor };
}

function budgetRisk(s) {
  const sem = s.currentSem;
  const budget = sem ? (s.budgets?.[sem] ?? 0) : 0;
  if (budget <= 0) return { level: 'ok', pct: null, spent: 0, budget: 0, sem };
  const semExps = (s.expenses?.[sem] || []).filter((e) => e.avb === 'Actual');
  const spent = semExps.reduce((t, e) => t + (e.amount || 0) * (e.qty || 1), 0);
  const pct = spent / budget;
  const level = pct > 0.9 ? 'risk' : pct > 0.75 ? 'watch' : 'ok';
  return { level, pct, spent, budget, sem };
}

// Sourced live from NextGen Immersion's scholar_pace (see EnglishSection.jsx /
// app/api/immersion-hours) — its own ON_TRACK/AT_RISK/PENDING status already
// accounts for pace against the scholar's target, so we just adopt it rather
// than re-deriving a risk level from raw hours.
function englishRisk(imm) {
  if (!imm) return { level: 'ok', hrs: null, target: null };
  const level = imm.status === 'risk' ? 'risk' : imm.status === 'warning' ? 'watch' : 'ok';
  const { currentHours: hrs, targetHours: target } = imm;
  const pct = target ? hrs / target : null;
  const remaining = target != null ? Math.max(0, target - hrs) : null;
  return { level, hrs, pct, remaining, target };
}

function nextPendingMilestone(s) {
  return (s.milestones || []).find((m) => m.state !== 'done') || null;
}

// ── Mini progress bar ─────────────────────────────────────────────────────────

function Bar({ pct, level }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(Math.min(100, Math.max(0, pct * 100))));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  const color =
    level === 'risk'
      ? 'var(--ngs-red)'
      : level === 'watch'
        ? 'var(--ngs-warn)'
        : 'var(--ngs-green)';
  return (
    <div className="risk-bar-track">
      <div className="risk-bar-fill" style={{ width: w + '%', background: color }} />
    </div>
  );
}

// ── Per-scholar risk card ─────────────────────────────────────────────────────

function RiskCard({ sk, imm, liveGpa }) {
  const { D } = useData();
  const s = D.scholars[sk];
  const nc = NAMECLASS[sk] || '';

  const gpa = gpaRisk(s, liveGpa);
  const budget = budgetRisk(s);
  const english = englishRisk(imm);
  const ms = nextPendingMilestone(s);

  const overall = riskLevel([gpa.level, budget.level, english.level]);

  const RISK_LABEL = { ok: 'On Track', watch: 'Watch', risk: 'At Risk' };
  const RISK_CLS = { ok: 'risk-flag-ok', watch: 'risk-flag-watch', risk: 'risk-flag-risk' };

  return (
    <div className={`risk-card risk-card-${overall}`}>
      <div className="risk-card-header">
        <span className={`risk-scholar-name ${nc}`}>{s?.name || sk}</span>
        <span className={`risk-flag ${RISK_CLS[overall]}`}>{RISK_LABEL[overall]}</span>
      </div>

      {/* GPA */}
      <div className="risk-metric">
        <div className="risk-metric-top">
          <span className="risk-metric-label">GPA</span>
          <span className={`risk-metric-value risk-val-${gpa.level}`}>
            {gpa.gpa != null ? `${Math.round(gpa.gpa)}%` : '—'}
            {gpa.gpa != null && gpa.floor != null && (
              <span className="risk-metric-floor"> / {gpa.floor}% floor</span>
            )}
          </span>
        </div>
        {gpa.gpa != null && gpa.floor != null && <Bar pct={gpa.gpa / 100} level={gpa.level} />}
        <div className="risk-metric-note">
          {gpa.gpa == null
            ? 'No GPA recorded yet'
            : gpa.level === 'risk'
              ? `${(gpa.floor - gpa.gpa).toFixed(1)}pts below floor`
              : gpa.level === 'watch'
                ? `${(gpa.gpa - gpa.floor).toFixed(1)}pts above floor`
                : `${(gpa.gpa - gpa.floor).toFixed(1)}pts above floor`}
        </div>
      </div>

      {/* English */}
      <div className="risk-metric">
        <div className="risk-metric-top">
          <span className="risk-metric-label">OET English</span>
          <span className={`risk-metric-value risk-val-${english.level}`}>
            {english.hrs != null ? `${english.hrs.toFixed(1)} hrs` : '—'}
            {english.target != null && (
              <span className="risk-metric-floor"> / {english.target} hrs</span>
            )}
          </span>
        </div>
        {english.hrs != null && english.pct != null && (
          <Bar pct={english.pct} level={english.level} />
        )}
        <div className="risk-metric-note">
          {english.hrs == null
            ? 'No Immersion account linked yet'
            : english.remaining == null
              ? 'No target set'
              : english.remaining === 0
                ? 'Target reached'
                : `${english.remaining.toFixed(0)} hrs remaining`}
        </div>
      </div>

      {/* Budget */}
      <div className="risk-metric">
        <div className="risk-metric-top">
          <span className="risk-metric-label">
            Budget {budget.sem ? <span className="risk-sem-chip">{budget.sem}</span> : null}
          </span>
          <span className={`risk-metric-value risk-val-${budget.level}`}>
            {budget.pct != null ? `${Math.round(budget.pct * 100)}% used` : '—'}
          </span>
        </div>
        {budget.pct != null && <Bar pct={budget.pct} level={budget.level} />}
        <div className="risk-metric-note">
          {budget.budget === 0
            ? 'No budget set for current sem'
            : `₱${Math.round(budget.spent).toLocaleString()} of ₱${Math.round(budget.budget).toLocaleString()}`}
        </div>
      </div>

      {/* Next milestone */}
      <div className="risk-metric risk-metric-last">
        <span className="risk-metric-label">Next milestone</span>
        <div className="risk-milestone">
          {ms ? (
            <>
              <span className="risk-ms-name">{ms.name}</span>
              {ms.sem && <span className="risk-ms-sem">{ms.sem}</span>}
            </>
          ) : (
            <span className="risk-ms-none">All milestones complete</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function RiskSection({ id, collapsed, onToggle, liveGpa = {} }) {
  const { scholarKeys } = useData();
  const [immersion, setImmersion] = useState({});

  useEffect(() => {
    api
      .get('/immersion-hours')
      .then((data) => setImmersion(data || {}))
      .catch(() => {});
  }, []);

  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        Risk Dashboard
        <span className="eyebrow-rule" />
        <button
          className="section-collapse-btn"
          onClick={onToggle}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="risk-body">
          <div className="section-head">
            <h2 className="section-title">Cohort risk overview</h2>
            <span className="section-note">GPA · English · Budget · Milestones</span>
          </div>
          <div className="risk-grid">
            {scholarKeys.map((sk) => (
              <RiskCard
                key={sk}
                sk={sk}
                imm={immersion[sk] ?? null}
                liveGpa={liveGpa[sk] ?? null}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
