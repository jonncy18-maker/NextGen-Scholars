import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useData } from '../context/DataContext.jsx';
import { nextMilestone } from '../utils.js';
import { SEMESTER_OPTIONS } from '../constants.js';

const SEM_DISPLAY = {
  TG11S1:'G11·S1', TG11S2:'G11·S2', TG12S1:'G12·S1', TG12S2:'G12·S2',
  Y1S1:'Y1·S1', Y1S2:'Y1·S2', Y2S1:'Y2·S1', Y2S2:'Y2·S2',
  Y3S1:'Y3·S1', Y3S2:'Y3·S2', Y4S1:'Y4·S1', Y4S2:'Y4·S2',
  PostY1:'Post·Y1', PostY2:'Post·Y2', PostY3:'Post·Y3', PostY4:'Post·Y4',
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

function daysUntil(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return `${diff}d`;
}

export function MentorHome({ liveGpa, onOpenDrawer, pendingCount = 0, activityCount = 0, onSemesterChange }) {
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

  const upcomingDeadlines = (D.deadlines || [])
    .filter(d => d.sort_date >= today)
    .sort((a, b) => a.sort_date.localeCompare(b.sort_date))
    .slice(0, 4);

  const budgetHealth = scholarKeys.map(key => {
    const s = D.scholars[key];
    const sem = s?.currentSem;
    const pct = semBudgetPct(s, sem);
    return { key, name: s?.firstName || key, pct, sem };
  });

  const nextTravels = scholarKeys.map(key => {
    const s = D.scholars[key];
    const next = (s?.travels || []).find(t => t.state !== 'done');
    return { key, name: s?.firstName || key, travel: next };
  });

  const nextMilestones = scholarKeys.map(key => {
    const s = D.scholars[key];
    const nm = nextMilestone(s);
    return { key, name: s?.firstName || key, milestone: nm };
  });

  return (
    <section className="mh-section">

      {/* ── Scholar Overview ── */}
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
          const engStr = eng ? `${eng.hours} / ${eng.goal} hrs` : '—';
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
                  {onSemesterChange ? (
                    <select
                      className="mh-sem-select"
                      value={sem}
                      onChange={e => onSemesterChange(key, e.target.value)}
                    >
                      {sem && !SEMESTER_OPTIONS.includes(sem) && (
                        <option value={sem}>{SEM_DISPLAY[sem] || sem}</option>
                      )}
                      {SEMESTER_OPTIONS.map(o => (
                        <option key={o} value={o}>{SEM_DISPLAY[o] || o}</option>
                      ))}
                    </select>
                  ) : (
                    <span>{SEM_DISPLAY[sem] || sem || '—'}</span>
                  )}
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

      {/* ── Dashboard Widgets ── */}
      <div className="mh-eyebrow mh-eyebrow--mt">
        <span className="mh-eyebrow-label">At a Glance</span>
      </div>

      <div className="mh-dash">
        <Link
          className={`mh-dash-stat${pendingCount > 0 ? ' is-alert' : ''}`}
          to="/navigator/expenses"
        >
          <span className="mh-dash-val">{pendingCount}</span>
          <span className="mh-dash-lbl">Pending approvals</span>
        </Link>

        <Link
          className={`mh-dash-stat${activityCount > 0 ? ' is-warn' : ''}`}
          to="/navigator/expenses"
        >
          <span className="mh-dash-val">{activityCount}</span>
          <span className="mh-dash-lbl">Unread activity</span>
        </Link>

        <div className="mh-dash-panel">
          <div className="mh-dash-panel-head">Next deadlines</div>
          {upcomingDeadlines.length === 0 ? (
            <div className="mh-dash-empty">No upcoming deadlines</div>
          ) : upcomingDeadlines.map((d, i) => (
            <div key={i} className="mh-dash-dl">
              <span className="mh-dash-dl-when">{daysUntil(d.sort_date)}</span>
              <span className="mh-dash-dl-event">{d.event}</span>
            </div>
          ))}
        </div>

        <div className="mh-dash-panel">
          <div className="mh-dash-panel-head">Budget health</div>
          {budgetHealth.map(({ key, name, pct }) => (
            <div key={key} className="mh-dash-budget-row">
              <span className="mh-dash-budget-name">{name}</span>
              <div className="mh-dash-bar-track">
                <div
                  className={`mh-dash-bar${pct != null && pct >= 100 ? ' is-over' : pct != null && pct >= 90 ? ' is-warn' : ''}`}
                  style={{ width: `${Math.min(pct || 0, 100)}%` }}
                />
              </div>
              <span className="mh-dash-budget-pct">{pct != null ? `${pct}%` : '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Module Cards ── */}
      <div className="mh-eyebrow mh-eyebrow--mt">
        <span className="mh-eyebrow-label">Modules</span>
      </div>

      <div className="mh-modules">

        <Link className="mm-card" to="/navigator/expenses">
          <div className="mm-card-tag">EXP</div>
          <div className="mm-card-label">Expenses</div>
          <div className="mm-card-blurb">
            {pendingCount > 0 ? `${pendingCount} pending approval${pendingCount !== 1 ? 's' : ''}` : 'Budgets & spend tracking'}
          </div>
        </Link>

        <Link className="mm-card" to="/navigator/grades">
          <div className="mm-card-tag">GPA</div>
          <div className="mm-card-label">Grades</div>
          <div className="mm-card-blurb">
            {scholarKeys.map(k => liveGpa?.[k] != null ? `${D.scholars[k]?.firstName || k} ${liveGpa[k].toFixed(1)}%` : null).filter(Boolean).join(' · ') || 'Transcript & GPA'}
          </div>
        </Link>

        <Link className="mm-card" to="/navigator/english">
          <div className="mm-card-tag">ENG</div>
          <div className="mm-card-label">English</div>
          <div className="mm-card-blurb">OET / IELTS hours tracker</div>
        </Link>

        <Link className="mm-card" to="/navigator/travel">
          <div className="mm-card-tag">TRV</div>
          <div className="mm-card-label">Travel</div>
          <div className="mm-card-items">
            {nextTravels.filter(({ key }) => D.scholars[key]?.track === 'NGN').map(({ key, name, travel }) => (
              <div key={key} className="mm-card-row">
                <span className="mm-card-row-name">{name}</span>
                {travel ? (
                  <>
                    <span className={`mm-state mm-state--${travel.state}`}>{travel.state}</span>
                    <span className="mm-card-row-detail">{travel.dest}</span>
                  </>
                ) : (
                  <span className="mm-card-row-detail">All done</span>
                )}
              </div>
            ))}
          </div>
        </Link>

        <div className="mm-card mm-card--info">
          <div className="mm-card-tag">MLS</div>
          <div className="mm-card-label">Milestones</div>
          <div className="mm-card-items">
            {nextMilestones.map(({ key, name, milestone }) => (
              <div key={key} className="mm-card-row">
                <span className="mm-card-row-name">{name}</span>
                <span className="mm-card-row-detail">{milestone.name}</span>
              </div>
            ))}
          </div>
        </div>

        <Link className="mm-card" to="/navigator/docs">
          <div className="mm-card-tag">DOC</div>
          <div className="mm-card-label">Documents</div>
          <div className="mm-card-blurb">Files, uploads & records</div>
        </Link>

      </div>
    </section>
  );
}
