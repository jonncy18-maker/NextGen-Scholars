import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext.jsx';
import { useFmt } from '../context/FxContext.jsx';
import { scholarTotals, nextMilestone, accentFor } from '../utils.js';

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

function ScholarCard({ sk, currency, liveGpa }) {
  const $fmt = useFmt();
  const { D } = useData();
  const s = { ...D.scholars[sk], _key: sk };
  const gpa = latestGpa(s, liveGpa);
  const tot = scholarTotals(s);
  const budgetPct = tot.allocated ? Math.min(100, Math.round(tot.total / tot.allocated * 100)) : 0;
  const next = nextMilestone(s);
  const pillCls = { active: 'active', trial: 'trial' }[s.status] || 'paused';
  const pillTxt = { active: 'Active', trial: 'Trial' }[s.status] || 'Paused';

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
        <div className="scard-next">
          <div className="scard-next-lbl">Next milestone</div>
          <div className="scard-next-name">{next.name}</div>
          <div className="scard-next-detail">{next.detail}</div>
        </div>
      </div>
    </article>
  );
}

export function StatusSection({ currency, liveGpa }) {
  const { scholarKeys } = useData();
  return (
    <section className="section">
      <div className="eyebrow"><span className="num">02</span> Scholar Status <span className="eyebrow-rule" /></div>
      <div className="section-head">
        <h2 className="section-title">Three lives in motion</h2>
        <span className="section-note">Live academic &amp; investment snapshot.</span>
      </div>
      <div className="status-grid">
        {scholarKeys.map(k => <ScholarCard key={k} sk={k} currency={currency} liveGpa={liveGpa} />)}
      </div>
    </section>
  );
}
