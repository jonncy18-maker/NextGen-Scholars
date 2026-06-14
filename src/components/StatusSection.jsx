import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext.jsx';
import { useFmt } from '../context/FxContext.jsx';
import { scholarTotals, nextMilestone, accentFor } from '../utils.js';
import { SEMESTER_OPTIONS } from '../constants.js';
import { supabase } from '../lib/supabase.js';

const SUPABASE_URL = 'https://rhoxpfuephkuaartuqou.supabase.co';

const SEM_WEEKS = 16;

function computeTrajectory(s) {
  const sem = s.currentSem;
  if (!sem) return null;
  const semExps = (s.expenses?.[sem] || []).filter(e => e.avb === 'Actual');
  if (semExps.length === 0) return null;
  const budget = s.budgets?.[sem] || 0;
  if (budget <= 0) return null;
  const currentSpend = semExps.reduce((t, e) => t + (e.amount || 0) * (e.qty || 1), 0);
  const sortedDates = semExps.map(e => e.date).filter(Boolean).sort();
  if (!sortedDates[0]) return null;
  const msPerWeek    = 7 * 24 * 60 * 60 * 1000;
  const weeksElapsed = Math.max(0.5, (Date.now() - new Date(sortedDates[0]).getTime()) / msPerWeek);
  const weeksLeft    = Math.max(0, SEM_WEEKS - weeksElapsed);
  const weeklyBurn   = currentSpend / weeksElapsed;
  const projected    = currentSpend + weeklyBurn * weeksLeft;
  return { projected, budget, overspend: projected - budget, currentSpend };
}

function gpaClass(gpa, floor) {
  if (gpa == null) return '';
  if (gpa >= floor + 2) return 'g-green';
  if (gpa >= floor) return 'g-amber';
  return 'g-red';
}

function latestGpa(s, liveGpa) {
  if (liveGpa[s._key] != null) return liveGpa[s._key];
  const closed = (s.academics || []).filter(a => a.gpa != null);
  return closed.length ? closed[closed.length - 1].gpa : null;
}

function ProgBar({ pct }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(pct));
    return () => cancelAnimationFrame(id);
  }, []);
  return <div className="scard-prog-fill" style={{ width: w + '%' }} />;
}

function CoachModal({ scholarName, text, onClose }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="mgroup-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mgroup-modal coach-modal">
        <div className="mgroup-header">
          <div className="mgroup-title">Coaching note · {scholarName}</div>
          <button className="mgroup-close" onClick={onClose}>✕</button>
        </div>
        <div className="coach-modal-body">
          <span className="nai-tier-badge nai-tier-2">Tier 2 · Gemini</span>
          <p className="coach-modal-text">{text}</p>
        </div>
        <div className="coach-modal-footer">
          <button className="nai-confirm-btn" onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy to clipboard'}
          </button>
          <button className="nai-discard-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function ScholarCard({ sk, currency, liveGpa, onSemesterChange }) {
  const $fmt = useFmt();
  const { D } = useData();
  const s = { ...D.scholars[sk], _key: sk };
  const gpa = latestGpa(s, liveGpa);
  const tot = scholarTotals(s);
  const budgetPct = tot.allocated ? Math.min(100, Math.round(tot.total / tot.allocated * 100)) : 0;
  const next = nextMilestone(s);
  const pillCls = { active: 'active', trial: 'trial' }[s.status] || 'paused';
  const pillTxt = { active: 'Active', trial: 'Trial' }[s.status] || 'Paused';

  const trajectory = computeTrajectory(s);
  const trajColor  = !trajectory ? null
    : trajectory.overspend > 0               ? 'red'
    : trajectory.projected > trajectory.budget * 0.9 ? 'amber'
    : 'green';

  const [noteLoading, setNoteLoading] = useState(false);
  const [noteText, setNoteText]       = useState(null);
  const [noteError, setNoteError]     = useState(null);

  async function handleDraftNote() {
    setNoteLoading(true);
    setNoteError(null);
    setNoteText(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired — please refresh and log in again.');
      const res  = await fetch(`${SUPABASE_URL}/functions/v1/ask`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ scholar: sk, type: 'coach' }),
      });
      const data = await res.json();
      if (!res.ok || data.status === 'error') throw new Error(data.error || 'Failed to generate note.');
      if (data.status === 'not_configured') throw new Error('AI key not configured — add GOOGLE_AI_KEY to Supabase secrets.');
      setNoteText(data.note);
    } catch (err) {
      setNoteError(err.message);
    } finally {
      setNoteLoading(false);
    }
  }

  return (
    <article className={`scard accent-${accentFor(s)}`}>
      <div className="scard-body">
        <div className="scard-head">
          <div className="scard-name">{s.firstName}</div>
          <span className={`pill ${pillCls}`}>{pillTxt}</span>
        </div>
        <div className="scard-school">{s.school}</div>
        <div className="metric-grid">
          <div className="metric">
            <div className="metric-val">{s.currentSem || '—'}</div>
            <div className="metric-lbl">Current<br />Sem</div>
          </div>
          <div className="metric">
            <div className={`metric-val ${gpaClass(gpa, s.gpaFloor)}`}>{gpa != null ? gpa.toFixed(2) + '%' : '—'}</div>
            <div className="metric-lbl">Last<br />GPA</div>
          </div>
          <div className="metric">
            <div className="metric-val">{$fmt(tot.total, currency)}</div>
            <div className="metric-lbl">Total<br />Invested</div>
          </div>
          <div className="metric">
            <div className="metric-val">{budgetPct}%</div>
            <div className="metric-lbl">Budget<br />Used</div>
          </div>
        </div>
        <div className="scard-prog"><ProgBar pct={budgetPct} /></div>
        <div className="scard-prog-lbl">
          {s.gpaFloor != null ? `Floor ${s.gpaFloor}% · ` : ''}{budgetPct}% of allocation deployed
        </div>
        {trajectory && (
          <div className={`scard-trajectory scard-traj-${trajColor}`}>
            {trajectory.overspend > 0
              ? `⚠ Projected overspend of ${$fmt(trajectory.overspend, currency)} — review expenses`
              : `On pace to spend ${$fmt(trajectory.projected, currency)} by end of semester`}
          </div>
        )}
        <div className="scard-next">
          <div className="scard-next-lbl">Next milestone</div>
          <div className="scard-next-name">{next.name}</div>
          <div className="scard-next-detail">{next.detail}</div>
        </div>
        <div className="scard-sem-row">
          <label className="scard-sem-lbl" htmlFor={`sem-${sk}`}>Active semester</label>
          <select
            id={`sem-${sk}`}
            className="scard-sem-select"
            value={s.currentSem || ''}
            onChange={e => onSemesterChange(sk, e.target.value)}
          >
            {s.currentSem && !SEMESTER_OPTIONS.includes(s.currentSem) && (
              <option value={s.currentSem}>{s.currentSem}</option>
            )}
            {SEMESTER_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div className="scard-draft-row">
          <button
            className="scard-draft-btn"
            onClick={handleDraftNote}
            disabled={noteLoading}
          >
            {noteLoading ? 'Drafting…' : 'Draft coaching note'}
          </button>
          {noteError && <div className="scard-draft-err">{noteError}</div>}
        </div>
      </div>
      {noteText && (
        <CoachModal
          scholarName={s.firstName}
          text={noteText}
          onClose={() => setNoteText(null)}
        />
      )}
    </article>
  );
}

export function StatusSection({ currency, liveGpa, onSemesterChange, id, collapsed, onToggle }) {
  const { scholarKeys } = useData();
  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        Scholar Status
        <span className="eyebrow-rule" />
        <button className="section-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand section' : 'Collapse section'}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="section-head">
            <h2 className="section-title">Three lives in motion</h2>
            <span className="section-note">Live academic &amp; investment snapshot.</span>
          </div>
          <div className="status-grid">
            {scholarKeys.map(k => (
              <ScholarCard key={k} sk={k} currency={currency} liveGpa={liveGpa} onSemesterChange={onSemesterChange} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
