import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useData } from '../context/DataContext.jsx';

const SEM_DISPLAY = {
  Y1S1:'Y1·S1', Y1S2:'Y1·S2', Y2S1:'Y2·S1', Y2S2:'Y2·S2',
  Y3S1:'Y3·S1', Y3S2:'Y3·S2', Y4S1:'Y4·S1', Y4S2:'Y4·S2',
  TG11S1:'G11·S1', TG11S2:'G11·S2', TG12S1:'G12·S1', TG12S2:'G12·S2',
};

function semBudgetPct(scholar, sem) {
  if (!sem) return null;
  const expenses = (scholar.expenses?.[sem] || [])
    .filter(e => e.avb === 'Actual')
    .reduce((t, e) => t + (e.amount || 0) * (e.qty || 1), 0);
  const budget = typeof scholar.budgets?.[sem] === 'number' ? scholar.budgets[sem] : 0;
  return budget > 0 ? Math.round((expenses / budget) * 100) : null;
}

function riskLevel(scholar, budgetPct) {
  const lastAcad = (scholar.academics || []).find(a => a.gpa != null);
  if (lastAcad?.status === 'warn' || (budgetPct != null && budgetPct >= 100)) return 'red';
  if (budgetPct != null && budgetPct >= 90) return 'amber';
  return 'green';
}

export function MentorHome({ liveGpa, onOpenDrawer }) {
  const { D, scholarKeys } = useData();
  const [engData, setEngData] = useState({});

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10);
      const { data: periods } = await supabase
        .from('english_periods')
        .select('*')
        .lte('start_date', today)
        .gte('end_date', today);

      if (!periods?.length) return;

      const result = {};
      await Promise.all(periods.map(async p => {
        const { data: sessions } = await supabase
          .from('english_sessions')
          .select('duration_minutes')
          .eq('scholar', p.scholar)
          .gte('date', p.start_date)
          .lte('date', p.end_date);
        const mins = (sessions || []).reduce((s, r) => s + (r.duration_minutes || 0), 0);
        result[p.scholar] = { hours: Math.round((mins / 60) * 10) / 10, goal: Number(p.hour_goal) };
      }));
      setEngData(result);
    }
    load().catch(() => {});
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <section className="mh-section">
      <div className="mh-eyebrow">
        <span className="mh-eyebrow-label">Scholar Overview</span>
        <span className="mh-eyebrow-date">{month}</span>
      </div>

      <div className="mh-grid">
        {scholarKeys.map(key => {
          const s = D.scholars[key];
          if (!s) return null;

          const sem = s.currentSem || '';
          const budgetPct = semBudgetPct(s, sem);
          const risk = riskLevel(s, budgetPct);
          const gpaPct = liveGpa?.[key] ?? null;

          const eng = engData[key];
          const engStr = eng
            ? `${eng.hours} / ${eng.goal} hrs`
            : '—';

          const nextDl = (D.deadlines || [])
            .filter(d => (d.scholar === key || !d.scholar) && d.sort_date >= today)
            .sort((a, b) => a.sort_date.localeCompare(b.sort_date))[0];

          const isActive = s.status === 'active';

          return (
            <div key={key} className={`mh-card mh-card--${isActive ? 'active' : 'trial'}`}>
              <div className="mh-card-header">
                <div className="mh-card-name-row">
                  <span className="mh-card-first">{s.firstName || s.name || key}</span>
                  <span className={`mh-risk mh-risk--${risk}`}>
                    {risk === 'red' ? 'Alert' : risk === 'amber' ? 'Watch' : 'Good'}
                  </span>
                </div>
                <div className="mh-card-meta">
                  <span>{s.track || '—'}</span>
                  <span className="mh-sep">·</span>
                  <span>{SEM_DISPLAY[sem] || sem || '—'}</span>
                </div>
              </div>

              <div className="mh-stats">
                <div className="mh-stat">
                  <span className="mh-stat-val">
                    {gpaPct != null ? `${gpaPct.toFixed(1)}%` : '—'}
                  </span>
                  <span className="mh-stat-label">GPA</span>
                </div>
                <div className="mh-stat">
                  <span className={`mh-stat-val${budgetPct != null && budgetPct >= 90 ? ' is-warn' : ''}`}>
                    {budgetPct != null ? `${budgetPct}%` : '—'}
                  </span>
                  <span className="mh-stat-label">Budget</span>
                </div>
                <div className="mh-stat">
                  <span className="mh-stat-val">{engStr}</span>
                  <span className="mh-stat-label">English</span>
                </div>
              </div>

              <div className="mh-deadline-row">
                {nextDl ? (
                  <>
                    <span className="mh-dl-icon">⏰</span>
                    <span className="mh-dl-text">{nextDl.event}</span>
                    <span className="mh-dl-date">{nextDl.when_date}</span>
                  </>
                ) : (
                  <span className="mh-dl-none">No upcoming deadlines</span>
                )}
              </div>

              <div className="mh-actions">
                <button className="mh-btn" onClick={() => onOpenDrawer('query', key)}>Ask →</button>
                <Link className="mh-btn" to="/navigator/expenses">Log $</Link>
                <Link className="mh-btn" to="/navigator/grades">Log Grades</Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mh-quick-links">
        <Link className="mh-quick-link" to="/navigator/expenses">Expenses →</Link>
        <Link className="mh-quick-link" to="/navigator/grades">Grades →</Link>
        <Link className="mh-quick-link" to="/navigator/english">English →</Link>
        <Link className="mh-quick-link" to="/navigator/deadlines">Deadlines →</Link>
        <Link className="mh-quick-link" to="/navigator/progress">Progress →</Link>
        <Link className="mh-quick-link" to="/navigator/docs">Docs →</Link>
      </div>
    </section>
  );
}
