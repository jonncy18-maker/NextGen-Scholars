import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../lib/api.js';
import { useData } from '../context/DataContext.jsx';
import { SEMESTER_OPTIONS } from '../constants.js';
import { daysSinceLastExpense, monthlySpendTrend } from '../utils.js';

const SEM_DISPLAY = {
  TG11S1: 'G11·S1',
  TG11S2: 'G11·S2',
  TG12S1: 'G12·S1',
  TG12S2: 'G12·S2',
  Y1S1: 'Y1·S1',
  Y1S2: 'Y1·S2',
  Y2S1: 'Y2·S1',
  Y2S2: 'Y2·S2',
  Y3S1: 'Y3·S1',
  Y3S2: 'Y3·S2',
  Y4S1: 'Y4·S1',
  Y4S2: 'Y4·S2',
  PostY1: 'Post·Y1',
  PostY2: 'Post·Y2',
  PostY3: 'Post·Y3',
  PostY4: 'Post·Y4',
  TESDA: 'TESDA',
};

// Mirrors CareerSection.jsx's pipeline — nursing-track only, so TESDA
// scholars (no career_steps rows) simply get no pathway bar.
const CAREER_STEPS = ['PNLE', 'OET', 'NCLEX', 'OSCE', 'AHPRA'];

function semBudgetPct(scholar, sem) {
  if (!sem) return null;
  const expenses = (scholar.expenses?.[sem] || [])
    .filter((e) => e.avb === 'Actual')
    .reduce((t, e) => t + (e.amount || 0) * (e.qty || 1), 0);
  const budget = typeof scholar.budgets?.[sem] === 'number' ? scholar.budgets[sem] : 0;
  return budget > 0 ? Math.round((expenses / budget) * 100) : null;
}

function riskLevel(scholar, budgetPct) {
  const lastAcad = (scholar.academics || []).find((a) => a.gpa != null);
  if (lastAcad?.status === 'warn' || (budgetPct != null && budgetPct >= 100)) return 'red';
  if (budgetPct != null && budgetPct >= 90) return 'amber';
  return 'green';
}

function pathwayStage(careerRows, key) {
  const rows = careerRows.filter((r) => r.scholar === key);
  if (!rows.length) return null;
  const byStep = Object.fromEntries(rows.map((r) => [r.step, r.status]));
  const passedCount = CAREER_STEPS.filter((s) => byStep[s] === 'passed').length;
  const currentStep = CAREER_STEPS.find((s) => byStep[s] && byStep[s] !== 'passed');
  const label =
    passedCount === CAREER_STEPS.length
      ? 'Pathway complete'
      : currentStep
        ? `${currentStep} · ${byStep[currentStep].replace('_', ' ')}`
        : 'Not started';
  return { passedCount, total: CAREER_STEPS.length, label };
}

// Days since the scholar's most recent expense activity — the newer of their
// last approved expense (daysSinceLastExpense, which reads the committed
// `expenses` table) and their most recent pending submission. Pending
// submissions live in a separate table and never land in `expenses` until a
// mentor approves them, so a scholar who just submitted (or edited a pending
// submission) would otherwise look stale here. `updated_at` is bumped by a DB
// trigger on every edit, so an edit today refreshes recency too.
function daysSinceActivity(s, key, pendingSubmissions) {
  const candidates = [];
  const approved = daysSinceLastExpense(s);
  if (approved != null) candidates.push(approved);
  const latest = (pendingSubmissions || [])
    .filter((p) => p.scholar_key === key)
    .map((p) => p.updated_at || p.created_at)
    .filter(Boolean)
    .reduce((a, b) => (a > b ? a : b), '');
  if (latest) candidates.push(Math.floor((Date.now() - new Date(latest).getTime()) / 86400000));
  return candidates.length ? Math.min(...candidates) : null;
}

function TrendArrow({ current, previous, higherIsBetter = true, fmt = (v) => v }) {
  if (current == null || previous == null)
    return <span className="mh-trend mh-trend--flat">—</span>;
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) return <span className="mh-trend mh-trend--flat">—</span>;
  const isUp = diff > 0;
  const isGood = isUp === higherIsBetter;
  return (
    <span className={`mh-trend mh-trend--${isGood ? 'good' : 'bad'}`}>
      {isUp ? '▴' : '▾'} {fmt(Math.abs(diff))}
    </span>
  );
}

export function MentorHome({
  liveGpa,
  prevGpa,
  onOpenDrawer,
  pendingSubmissions = [],
  activityCount = 0,
  dbAlerts = [],
  onSemesterChange,
}) {
  const { D, scholarKeys } = useData();
  const [engData, setEngData] = useState({});
  const [career, setCareer] = useState([]);

  useEffect(() => {
    api
      .get('/immersion-hours')
      .then((data) => setEngData(data || {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get('/career')
      .then((rows) => setCareer(rows || []))
      .catch(() => setCareer([]));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const nextTravels = scholarKeys.map((key) => {
    const s = D.scholars[key];
    const next = (s?.travels || []).find((t) => t.state !== 'done');
    return { key, name: s?.firstName || key, travel: next };
  });

  const nextMilestones = scholarKeys.map((key) => {
    const s = D.scholars[key];
    const next = (s?.milestones || []).find((m) => m.state !== 'done');
    return { key, name: s?.firstName || key, milestone: next };
  });

  // ── "Needs attention" — DB alerts (GPA risk, etc.) + pending approvals,
  // each with a direct link to where the mentor fixes it. Empty → all clear.
  // Pending approvals are ranked right after critical alerts (not appended
  // last) so they can't get silently truncated out of the slice(0, 3) below
  // once alert volume grows.
  const attentionItems = dbAlerts.map((a) => ({
    severity: a.severity === 'critical' ? 'critical' : 'warning',
    rank: a.severity === 'critical' ? 0 : 2,
    title: a.title,
    sub: a.sub,
    href: '/navigator/progress',
    actionLabel: 'Review →',
  }));
  if (pendingSubmissions.length > 0) {
    const oldest = pendingSubmissions.reduce(
      (old, s) => (!old || s.created_at < old.created_at ? s : old),
      null
    );
    const oldestDays = oldest
      ? Math.floor((Date.now() - new Date(oldest.created_at).getTime()) / 86400000)
      : null;
    attentionItems.push({
      severity: 'warning',
      rank: 1,
      title: `${pendingSubmissions.length} expense submission${pendingSubmissions.length !== 1 ? 's' : ''} waiting for approval`,
      sub:
        oldestDays != null
          ? `Oldest is ${oldestDays === 0 ? 'today' : `${oldestDays}d old`}`
          : null,
      href: '/navigator/expenses',
      actionLabel: 'Approve →',
    });
  }
  attentionItems.sort((a, b) => a.rank - b.rank);

  // ── Cohort pulse — one horizontal scan instead of a tile grid.
  const needsAttentionCount = scholarKeys.filter((key) => {
    const s = D.scholars[key];
    return riskLevel(s, semBudgetPct(s, s.currentSem)) !== 'green';
  }).length;

  const deadlinesNext14 = (D.deadlines || []).filter((d) => {
    if (d.sort_date < today) return false;
    const diff = Math.ceil((new Date(d.sort_date) - new Date()) / 86400000);
    return diff <= 14;
  }).length;

  const cohortSpend = scholarKeys.reduce(
    (acc, key) => {
      const { thisMonth, lastMonth } = monthlySpendTrend(D.scholars[key]);
      acc.thisMonth += thisMonth;
      acc.lastMonth += lastMonth;
      return acc;
    },
    { thisMonth: 0, lastMonth: 0 }
  );
  const spendDeltaPct =
    cohortSpend.lastMonth > 0
      ? Math.round(((cohortSpend.thisMonth - cohortSpend.lastMonth) / cohortSpend.lastMonth) * 100)
      : null;

  const cohortEngHrsThisWeek = Object.values(engData).reduce(
    (t, e) => t + (e.hoursThisWeek || 0),
    0
  );

  return (
    <section className="mh-section">
      {/* ── Needs Attention ── */}
      <div className="mh-eyebrow">
        <span className="mh-eyebrow-label">Needs Attention</span>
      </div>
      {attentionItems.length === 0 ? (
        <div className="mh-attn-clear">All clear — nothing needs your review right now.</div>
      ) : (
        <div className="mh-attn-list">
          {attentionItems.slice(0, 3).map((item, i) => (
            <div key={i} className={`mh-attn-row mh-attn-row--${item.severity}`}>
              <span className="mh-attn-stripe" />
              <span className="mh-attn-sev">
                {item.severity === 'critical' ? 'Critical' : 'Watch'}
              </span>
              <span className="mh-attn-text">
                {item.title}
                {item.sub && <span className="mh-attn-sub"> — {item.sub}</span>}
              </span>
              <Link className="mh-attn-act" href={item.href}>
                {item.actionLabel}
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* ── This Week (cohort pulse) ── */}
      <div className="mh-eyebrow mh-eyebrow--mt">
        <span className="mh-eyebrow-label">This Week</span>
        <span className="mh-eyebrow-date">{month}</span>
      </div>
      <div className="mh-pulse">
        <div className="mh-pulse-cell">
          <span className="mh-pulse-num">{scholarKeys.length}</span>
          <span className="mh-pulse-lbl">Scholars</span>
        </div>
        <div className={`mh-pulse-cell${needsAttentionCount > 0 ? ' is-flag' : ''}`}>
          <span className="mh-pulse-num">{needsAttentionCount}</span>
          <span className="mh-pulse-lbl">Needs attention</span>
        </div>
        <div className="mh-pulse-cell">
          <span className="mh-pulse-num">{activityCount}</span>
          <span className="mh-pulse-lbl">Unread activity</span>
        </div>
        <div className="mh-pulse-cell">
          <span className="mh-pulse-num">
            {'₱' + Math.round(cohortSpend.thisMonth).toLocaleString('en-US')}
            {spendDeltaPct != null && (
              <span className={`mh-pulse-trend ${spendDeltaPct <= 0 ? 'is-good' : 'is-bad'}`}>
                {spendDeltaPct > 0 ? '▴' : '▾'} {Math.abs(spendDeltaPct)}%
              </span>
            )}
          </span>
          <span className="mh-pulse-lbl">Spent this month</span>
        </div>
        <div className="mh-pulse-cell">
          <span className="mh-pulse-num">{deadlinesNext14}</span>
          <span className="mh-pulse-lbl">Deadlines · 14 days</span>
        </div>
        {pendingSubmissions.length > 0 ? (
          <Link className="mh-pulse-cell is-flag" href="/navigator/expenses">
            <span className="mh-pulse-num">{pendingSubmissions.length}</span>
            <span className="mh-pulse-lbl">Pending approvals</span>
          </Link>
        ) : (
          <div className="mh-pulse-cell">
            <span className="mh-pulse-num">{pendingSubmissions.length}</span>
            <span className="mh-pulse-lbl">Pending approvals</span>
          </div>
        )}
        <div className="mh-pulse-cell">
          <span className="mh-pulse-num">{cohortEngHrsThisWeek.toFixed(1)}h</span>
          <span className="mh-pulse-lbl">English · this week</span>
        </div>
      </div>

      {/* ── Scholar Overview ── */}
      <div className="mh-eyebrow mh-eyebrow--mt">
        <span className="mh-eyebrow-label">Scholar Overview</span>
      </div>

      <div className="mh-grid">
        {scholarKeys.map((key) => {
          const s = D.scholars[key];
          if (!s) return null;

          const sem = s.currentSem || '';
          const budgetPct = semBudgetPct(s, sem);
          const risk = riskLevel(s, budgetPct);
          const gpaPct = liveGpa?.[key] ?? null;
          const gpaPrev = prevGpa?.[key] ?? null;
          const eng = engData[key];
          const engStr = eng
            ? eng.targetHours != null
              ? `${eng.currentHours} / ${eng.targetHours} hrs`
              : `${eng.currentHours} hrs`
            : '—';
          const nextDl = (D.deadlines || [])
            .filter((d) => (d.scholar === key || !d.scholar) && d.sort_date >= today)
            .sort((a, b) => a.sort_date.localeCompare(b.sort_date))[0];
          const isActive = s.status === 'active';
          const stage = pathwayStage(career, key);
          const daysSince = daysSinceActivity(s, key, pendingSubmissions);
          const isStale = daysSince != null && daysSince >= 7;

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
                      onChange={(e) => onSemesterChange(key, e.target.value)}
                    >
                      {sem && !SEMESTER_OPTIONS.includes(sem) && (
                        <option value={sem}>{SEM_DISPLAY[sem] || sem}</option>
                      )}
                      {SEMESTER_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {SEM_DISPLAY[o] || o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{SEM_DISPLAY[sem] || sem || '—'}</span>
                  )}
                </div>
              </div>

              {stage && (
                <div className="mh-stage">
                  <div className="mh-stage-track">
                    {Array.from({ length: stage.total }).map((_, i) => (
                      <span
                        key={i}
                        className={`mh-stage-seg${i < stage.passedCount ? ' is-done' : ''}`}
                      />
                    ))}
                  </div>
                  <div className="mh-stage-lbl">{stage.label}</div>
                </div>
              )}

              <div className="mh-stats">
                <div className="mh-stat">
                  <span className="mh-stat-val">
                    {gpaPct != null ? `${gpaPct.toFixed(1)}%` : '—'}
                    {gpaPct != null && (
                      <TrendArrow current={gpaPct} previous={gpaPrev} fmt={(v) => v.toFixed(1)} />
                    )}
                  </span>
                  <span className="mh-stat-label">GPA</span>
                </div>
                <div className="mh-stat">
                  <span
                    className={`mh-stat-val${budgetPct != null && budgetPct >= 90 ? ' is-warn' : ''}`}
                  >
                    {budgetPct != null ? `${budgetPct}%` : '—'}
                  </span>
                  <span className="mh-stat-label">Budget</span>
                </div>
                {s.track !== 'TESDA' && (
                  <div className="mh-stat">
                    <span className="mh-stat-val">
                      {engStr}
                      {eng?.hoursThisWeek > 0 && (
                        <span className="mh-trend mh-trend--flat">+{eng.hoursThisWeek}h wk</span>
                      )}
                    </span>
                    <span className="mh-stat-label">English</span>
                  </div>
                )}
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

              <div className={`mh-last-active${isStale ? ' is-stale' : ''}`}>
                <span className="mh-last-active-dot" />
                {daysSince == null
                  ? 'No expenses logged yet'
                  : daysSince === 0
                    ? 'Logged expenses today'
                    : `${isStale ? 'No activity in ' : 'Logged expenses '}${daysSince}d${isStale ? '' : ' ago'}`}
              </div>

              <div className="mh-actions">
                <button className="mh-btn" onClick={() => onOpenDrawer('query', key)}>
                  Ask →
                </button>
                <Link className="mh-btn" href="/navigator/expenses">
                  Log $
                </Link>
                <Link className="mh-btn" href="/navigator/grades">
                  Log Grades
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Module Cards ── */}
      <div className="mh-eyebrow mh-eyebrow--mt">
        <span className="mh-eyebrow-label">Modules</span>
      </div>

      <div className="mh-modules">
        <Link className="mm-card" href="/navigator/expenses">
          <div className="mm-card-tag">EXP</div>
          <div className="mm-card-label">Expenses</div>
          <div className="mm-card-blurb">
            {pendingSubmissions.length > 0
              ? `${pendingSubmissions.length} pending approval${pendingSubmissions.length !== 1 ? 's' : ''}`
              : 'Budgets & spend tracking'}
          </div>
        </Link>

        <Link className="mm-card" href="/navigator/grades">
          <div className="mm-card-tag">GPA</div>
          <div className="mm-card-label">Grades</div>
          <div className="mm-card-blurb">
            {scholarKeys
              .map((k) =>
                liveGpa?.[k] != null
                  ? `${D.scholars[k]?.firstName || k} ${liveGpa[k].toFixed(1)}%`
                  : null
              )
              .filter(Boolean)
              .join(' · ') || 'Transcript & GPA'}
          </div>
        </Link>

        <Link className="mm-card" href="/navigator/english">
          <div className="mm-card-tag">ENG</div>
          <div className="mm-card-label">English</div>
          <div className="mm-card-blurb">Hours by scholar · opens Immersion</div>
        </Link>

        <Link className="mm-card" href="/navigator/travel">
          <div className="mm-card-tag">TRV</div>
          <div className="mm-card-label">Travel</div>
          <div className="mm-card-items">
            {nextTravels
              .filter(({ key }) => D.scholars[key]?.track === 'NGN')
              .map(({ key, name, travel }) => (
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

        <Link className="mm-card" href="/navigator/milestones">
          <div className="mm-card-tag">MLS</div>
          <div className="mm-card-label">Milestones</div>
          <div className="mm-card-items">
            {nextMilestones.map(({ key, name, milestone }) => (
              <div key={key} className="mm-card-row">
                <span className="mm-card-row-name">{name}</span>
                {milestone ? (
                  <>
                    <span className={`mm-state mm-state--${milestone.state}`}>
                      {milestone.state}
                    </span>
                    <span className="mm-card-row-detail">{milestone.name}</span>
                  </>
                ) : (
                  <span className="mm-card-row-detail">All done</span>
                )}
              </div>
            ))}
          </div>
        </Link>
      </div>
    </section>
  );
}
