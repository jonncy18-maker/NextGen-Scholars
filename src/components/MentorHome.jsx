import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../lib/api.js';
import { useData } from '../context/DataContext.jsx';
import { SEMESTER_OPTIONS } from '../constants.js';
import { daysSinceLastExpense, monthlySpendTrend } from '../utils.js';
import { Ring, Donut, Sparkline, MiniSteps } from './ShellViz.jsx';
import { IcnClock, IcnStar, IcnSparkle, IcnWallet, IcnGlobe } from './ShellIcons.jsx';

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
// scholars (no career_steps rows) simply get no journey stepper.
const CAREER_STEPS = ['Trial Period', 'University', 'PNLE', 'OET', 'NCLEX', 'OSCE', 'AHPRA'];

function semBudgetPct(scholar, sem) {
  if (!sem) return null;
  const expenses = (scholar.expenses?.[sem] || [])
    .filter((e) => e.avb === 'Actual')
    .reduce((t, e) => t + (e.amount || 0) * (e.qty || 1), 0);
  const budget = typeof scholar.budgets?.[sem] === 'number' ? scholar.budgets[sem] : 0;
  return budget > 0 ? Math.round((expenses / budget) * 100) : null;
}

function semSpendAndBudget(scholar, sem) {
  if (!sem) return { spent: 0, budget: 0 };
  const spent = (scholar.expenses?.[sem] || [])
    .filter((e) => e.avb === 'Actual')
    .reduce((t, e) => t + (e.amount || 0) * (e.qty || 1), 0);
  const budget = typeof scholar.budgets?.[sem] === 'number' ? scholar.budgets[sem] : 0;
  return { spent, budget };
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

// Chronological rank for sem keys: TESDA/TG* (SHS) → Y* (college) → Post*.
// Within a group the keys sort lexically (Y1S1 < Y1S2 < Y2S1 …), so this is
// enough to order academics rows, whose raw select order isn't guaranteed.
function semRank(sem = '') {
  const group = sem.startsWith('Post') ? 2 : sem.startsWith('Y') ? 1 : 0;
  return `${group}${sem}`;
}

// GPA series (oldest → newest) for the glance-row sparkline — pulled from the
// scholar's academics history, which bootstrap loads in full.
function gpaSeries(scholar) {
  return (scholar.academics || [])
    .filter((a) => a.gpa != null)
    .slice()
    .sort((a, b) => semRank(a.sem).localeCompare(semRank(b.sem)))
    .map((a) => Number(a.gpa))
    .filter((v) => !Number.isNaN(v))
    .slice(-6);
}

function fmtPhp(n) {
  return '₱' + Math.round(n).toLocaleString('en-US');
}

function TrendArrow({ current, previous, higherIsBetter = true, fmt = (v) => v }) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) return null;
  const isUp = diff > 0;
  const isGood = isUp === higherIsBetter;
  return (
    <span className={`ds-stat-trend ${isGood ? 'is-good' : 'is-bad'}`}>
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
  unlocked = false,
}) {
  const { D, scholarKeys } = useData();
  const [engData, setEngData] = useState({});
  const [career, setCareer] = useState([]);

  // Gated on `unlocked` (CLAUDE.md rule): this component mounts behind
  // LockScreen, so an ungated fetch would run with whatever session cookie
  // the browser already has — possibly a scholar's — and cache its scoped
  // response without ever re-fetching after the mentor signs in.
  useEffect(() => {
    if (!unlocked) return;
    api
      .get('/immersion-hours')
      .then((data) => setEngData(data || {}))
      .catch(() => {});
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    api
      .get('/career')
      .then((rows) => setCareer(rows || []))
      .catch(() => setCareer([]));
  }, [unlocked]);

  const today = new Date().toISOString().slice(0, 10);

  // ── Per-scholar snapshot the glance rows + hero both read ──
  const rows = scholarKeys
    .map((key) => {
      const s = D.scholars[key];
      if (!s) return null;
      const sem = s.currentSem || '';
      const budgetPct = semBudgetPct(s, sem);
      const risk = riskLevel(s, budgetPct);
      // D.deadlines rows use {when, sort} (see api-loader.js / scholars-data.js)
      // — the old MentorHome read d.sort_date/d.when_date here, which never
      // matched, so its "next deadline" was permanently empty. Fixed.
      const nextDl = (D.deadlines || [])
        .filter((d) => (d.scholar === key || !d.scholar) && (d.sort || '') >= today)
        .sort((a, b) => (a.sort || '').localeCompare(b.sort || ''))[0];
      const daysSince = daysSinceActivity(s, key, pendingSubmissions);
      return {
        key,
        s,
        sem,
        budgetPct,
        risk,
        nextDl,
        daysSince,
        stage: pathwayStage(career, key),
        gpa: liveGpa?.[key] ?? null,
        gpaPrev: prevGpa?.[key] ?? null,
        series: gpaSeries(s),
        eng: engData[key],
      };
    })
    .filter(Boolean);

  // ── Hero numbers ──
  const greenCount = rows.filter((r) => r.risk === 'green').length;
  const redCount = rows.filter((r) => r.risk === 'red').length;
  const attentionCount = rows.length - greenCount;
  const health =
    redCount > 0
      ? { cls: 'is-risk', label: 'At Risk', sub: `${redCount} scholar${redCount !== 1 ? 's' : ''} in the red — review now.` }
      : attentionCount > 0
        ? { cls: 'is-watch', label: 'Watch', sub: `${attentionCount} scholar${attentionCount !== 1 ? 's' : ''} drifting off plan.` }
        : { cls: '', label: 'Excellent', sub: 'Everything is progressing according to plan.' };
  const healthPct = rows.length ? Math.round((greenCount / rows.length) * 100) : null;

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

  const gpaVals = rows.map((r) => r.gpa).filter((v) => v != null);
  const avgGpa = gpaVals.length ? gpaVals.reduce((t, v) => t + v, 0) / gpaVals.length : null;

  // ── Insights strip (deterministic, from live data) ──
  const deadlinesNext14 = (D.deadlines || []).filter((d) => {
    if (!d.sort || d.sort < today) return false;
    return Math.ceil((new Date(d.sort) - new Date()) / 86400000) <= 14;
  }).length;
  const cohortEngHrsThisWeek = Object.values(engData).reduce(
    (t, e) => t + (e.hoursThisWeek || 0),
    0
  );
  const insights = [];
  if (spendDeltaPct != null) {
    insights.push({
      icon: <IcnWallet size={13} />,
      text: `Spending ${spendDeltaPct >= 0 ? 'up' : 'down'} ${Math.abs(spendDeltaPct)}% vs last month (${fmtPhp(cohortSpend.thisMonth)}).`,
    });
  }
  if (cohortEngHrsThisWeek > 0) {
    insights.push({
      icon: <IcnGlobe size={13} />,
      text: `Cohort logged ${cohortEngHrsThisWeek.toFixed(1)}h of English immersion this week.`,
    });
  }
  if (deadlinesNext14 > 0) {
    insights.push({
      icon: <IcnClock size={13} />,
      text: `${deadlinesNext14} deadline${deadlinesNext14 !== 1 ? 's' : ''} in the next 14 days.`,
    });
  }
  if (activityCount > 0) {
    insights.push({
      icon: <IcnSparkle size={13} />,
      text: `${activityCount} unread activity event${activityCount !== 1 ? 's' : ''} from scholars.`,
    });
  }

  // ── Needs attention (critical alerts + approvals) — unchanged logic ──
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

  // ── Rail: upcoming deadlines + next milestones + financial overview ──
  const upcoming = (D.deadlines || [])
    .filter((d) => (d.sort || '') >= today)
    .sort((a, b) => (a.sort || '').localeCompare(b.sort || ''))
    .slice(0, 5)
    .map((d) => {
      const days = Math.max(0, Math.ceil((new Date(d.sort) - new Date()) / 86400000));
      const who = d.scholar ? D.scholars[d.scholar]?.firstName || d.scholar : 'Program';
      return { ...d, days, who };
    });

  const nextMilestones = scholarKeys
    .map((key) => {
      const s = D.scholars[key];
      const next = (s?.milestones || []).find((m) => m.state !== 'done');
      return next ? { key, name: s?.firstName || key, milestone: next } : null;
    })
    .filter(Boolean);

  const fin = rows.reduce(
    (acc, r) => {
      const { spent, budget } = semSpendAndBudget(r.s, r.sem);
      acc.spent += spent;
      acc.budget += budget;
      return acc;
    },
    { spent: 0, budget: 0 }
  );
  const finRemaining = Math.max(0, fin.budget - fin.spent);
  const finPct = fin.budget > 0 ? Math.round((fin.spent / fin.budget) * 100) : null;

  return (
    <section className="mh">
      {/* ── Hero: portfolio health + stat tiles ── */}
      <div className="ds-hero">
        <div className={`ds-card ds-card--accent ds-health ${health.cls}`}>
          <div className="ds-health-body">
            <div className="ds-stat-label">Portfolio Health</div>
            <div className="ds-health-status">{health.label}</div>
            <div className="ds-health-sub">{health.sub}</div>
          </div>
          <Ring pct={healthPct} size={62} stroke={4.5}>
            <IcnSparkle size={18} />
          </Ring>
        </div>
        <div className="ds-card">
          <div className="ds-stat-label">Total Scholars</div>
          <div className="ds-stat-val">{rows.length}</div>
          <div className="ds-stat-sub">Active in program</div>
        </div>
        <div className="ds-card">
          <div className="ds-stat-label">Spent This Month</div>
          <div className="ds-stat-val">
            {fmtPhp(cohortSpend.thisMonth)}
            {spendDeltaPct != null && (
              <span className={`ds-stat-trend ${spendDeltaPct <= 0 ? 'is-good' : 'is-bad'}`}>
                {spendDeltaPct > 0 ? '▴' : '▾'} {Math.abs(spendDeltaPct)}%
              </span>
            )}
          </div>
          <div className="ds-stat-sub">Scholarship support · cohort</div>
        </div>
        <div className="ds-card">
          <div className="ds-stat-label">Avg Academic Standing</div>
          <div className="ds-stat-val">{avgGpa != null ? `${avgGpa.toFixed(1)}%` : '—'}</div>
          <div className="ds-stat-sub">Across all scholars</div>
        </div>
        <div className="ds-card">
          <div className="ds-stat-label">Requiring Attention</div>
          <div className={`ds-stat-val${attentionCount > 0 ? ' is-flag' : ''}`}>
            {attentionCount}
          </div>
          <div className="ds-stat-sub">
            {attentionCount > 0 ? 'Scholars need support' : 'All on track'}
          </div>
        </div>
      </div>

      {/* ── AI insights strip ── */}
      {insights.length > 0 && (
        <div className="ds-card ds-insights">
          <span className="ds-insights-tag">
            <IcnSparkle size={13} /> Insights
          </span>
          {insights.slice(0, 3).map((ins, i) => (
            <span key={i} className="ds-insight">
              <span className="ds-insight-icon">{ins.icon}</span>
              {ins.text}
            </span>
          ))}
          <button className="ds-insight-link" onClick={() => onOpenDrawer('query')}>
            Ask AI →
          </button>
        </div>
      )}

      {/* ── Needs attention ── */}
      {attentionItems.length > 0 && (
        <>
          <div className="ds-sec">
            <span className="ds-sec-title">Needs Attention</span>
          </div>
          {attentionItems.slice(0, 3).map((item, i) => (
            <div key={i} className={`ds-attn${item.severity === 'critical' ? ' ds-attn--critical' : ''}`}>
              <span className="ds-attn-sev">{item.severity === 'critical' ? 'Critical' : 'Watch'}</span>
              <span className="ds-attn-text">
                {item.title}
                {item.sub && <span className="ds-attn-sub"> — {item.sub}</span>}
              </span>
              <Link className="ds-attn-act" href={item.href}>
                {item.actionLabel}
              </Link>
            </div>
          ))}
        </>
      )}

      <div className="ds-cols">
        {/* ── Scholars at a glance ── */}
        <div className="ds-col-main">
          <div className="ds-sec">
            <span className="ds-sec-title">Scholars at a Glance</span>
            <Link className="ds-sec-link" href="/navigator/progress">
              View journey map →
            </Link>
          </div>
          <div className="ds-card ds-glance">
            <div className="ds-glance-head">
              <span>Scholar</span>
              <span>Journey Stage</span>
              <span>Academic</span>
              <span>Financial</span>
              <span>Risk</span>
              <span>Next Up</span>
            </div>
            {rows.map((r) => {
              const finChip =
                r.budgetPct == null
                  ? { cls: 'ds-chip--muted', label: 'No budget' }
                  : r.budgetPct >= 100
                    ? { cls: 'ds-chip--bad', label: `${r.budgetPct}% over` }
                    : r.budgetPct >= 90
                      ? { cls: 'ds-chip--warn', label: `${r.budgetPct}% used` }
                      : { cls: 'ds-chip--good', label: `${r.budgetPct}% used` };
              const riskChip =
                r.risk === 'red'
                  ? { cls: 'ds-chip--bad', label: 'High' }
                  : r.risk === 'amber'
                    ? { cls: 'ds-chip--warn', label: 'Med' }
                    : { cls: 'ds-chip--good', label: 'Low' };
              const isStale = r.daysSince != null && r.daysSince >= 7;
              return (
                <div key={r.key} className="ds-glance-row">
                  <div className="ds-who">
                    <span className="ds-avatar">{(r.s.firstName || r.key)[0].toUpperCase()}</span>
                    <div>
                      <div className="ds-who-name">{r.s.firstName || r.s.name || r.key}</div>
                      <div className="ds-who-sub">
                        <span>{r.s.track || '—'}</span>
                        {onSemesterChange ? (
                          <select
                            className="ds-sem-select"
                            value={r.sem}
                            onChange={(e) => onSemesterChange(r.key, e.target.value)}
                          >
                            {r.sem && !SEMESTER_OPTIONS.includes(r.sem) && (
                              <option value={r.sem}>{SEM_DISPLAY[r.sem] || r.sem}</option>
                            )}
                            {SEMESTER_OPTIONS.map((o) => (
                              <option key={o} value={o}>
                                {SEM_DISPLAY[o] || o}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>{SEM_DISPLAY[r.sem] || r.sem || '—'}</span>
                        )}
                        {isStale && (
                          <span style={{ color: 'var(--ds-bad)' }}>· quiet {r.daysSince}d</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    {r.stage ? (
                      <>
                        <MiniSteps total={r.stage.total} done={r.stage.passedCount} />
                        <div className="ds-steps-lbl">{r.stage.label}</div>
                      </>
                    ) : (
                      <span className="ds-who-sub">—</span>
                    )}
                  </div>
                  <div className="ds-metric">
                    <span className="ds-metric-val">
                      {r.gpa != null ? `${r.gpa.toFixed(1)}%` : '—'}
                      <TrendArrow current={r.gpa} previous={r.gpaPrev} fmt={(v) => v.toFixed(1)} />
                    </span>
                    <Sparkline values={r.series} />
                  </div>
                  <span className={`ds-chip ${finChip.cls}`}>{finChip.label}</span>
                  <span className={`ds-chip ${riskChip.cls}`}>{riskChip.label}</span>
                  <div className="ds-metric">
                    {r.nextDl ? (
                      <>
                        <span className="ds-metric-val" style={{ whiteSpace: 'normal', fontSize: 11.5 }}>
                          {r.nextDl.event}
                        </span>
                        <span className="ds-who-sub">{r.nextDl.when}</span>
                      </>
                    ) : (
                      <span className="ds-who-sub">No deadlines</span>
                    )}
                    <button className="ds-mini-btn" onClick={() => onOpenDrawer('query', r.key)}>
                      Ask AI →
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="ds-glance-foot">
              <span>
                Showing {rows.length} scholar{rows.length !== 1 ? 's' : ''}
              </span>
              <span>
                {rows
                  .filter((r) => r.eng && r.s.track !== 'TESDA')
                  .map((r) =>
                    r.eng.targetHours != null
                      ? `${r.s.firstName} ${r.eng.currentHours}/${r.eng.targetHours}h`
                      : `${r.s.firstName} ${r.eng.currentHours}h`
                  )
                  .join(' · ') || ''}
              </span>
            </div>
          </div>
        </div>

        {/* ── Rail ── */}
        <div className="ds-col-rail">
          <div>
            <div className="ds-sec">
              <span className="ds-sec-title">Upcoming Deadlines</span>
              <Link className="ds-sec-link" href="/navigator/deadlines">
                View all
              </Link>
            </div>
            <div className="ds-card">
              <div className="ds-dl-list">
                {upcoming.length === 0 && <div className="ds-empty">Nothing on the calendar.</div>}
                {upcoming.map((d, i) => (
                  <div key={d.id ?? i} className="ds-dl">
                    <span className={`ds-dl-icon${d.days <= 7 ? ' is-urgent' : ''}`}>
                      <IcnClock size={14} />
                    </span>
                    <div className="ds-dl-body">
                      <div className="ds-dl-title">{d.event}</div>
                      <div className="ds-dl-sub">
                        {d.who} · {d.when}
                      </div>
                    </div>
                    <div className="ds-dl-when">
                      <div className={`ds-dl-days${d.days <= 7 ? ' is-urgent' : ''}`}>{d.days}</div>
                      <div className="ds-dl-days-lbl">days</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="ds-sec">
              <span className="ds-sec-title">Financial Overview</span>
              <Link className="ds-sec-link" href="/navigator/expenses">
                View finances
              </Link>
            </div>
            <div className="ds-card">
              {fin.budget > 0 ? (
                <div className="ds-donut-wrap">
                  <Donut
                    size={118}
                    stroke={15}
                    centerVal={finPct != null ? `${finPct}%` : '—'}
                    centerLbl="of budget"
                    segments={[
                      { label: 'Spent', value: fin.spent, color: 'var(--ngs-gold)' },
                      { label: 'Remaining', value: finRemaining, color: 'var(--ngs-blue-nav)' },
                    ]}
                  />
                  <div className="ds-legend">
                    <div className="ds-legend-row">
                      <span className="ds-legend-swatch" style={{ background: 'var(--ngs-gold)' }} />
                      <span className="ds-legend-lbl">Spent</span>
                      <span className="ds-legend-val">{fmtPhp(fin.spent)}</span>
                    </div>
                    <div className="ds-legend-row">
                      <span className="ds-legend-swatch" style={{ background: 'var(--ngs-blue-nav)' }} />
                      <span className="ds-legend-lbl">Remaining</span>
                      <span className="ds-legend-val">{fmtPhp(finRemaining)}</span>
                    </div>
                    <div className="ds-legend-row">
                      <span className="ds-legend-swatch" style={{ background: 'var(--ds-rule)' }} />
                      <span className="ds-legend-lbl">Budget · current sems</span>
                      <span className="ds-legend-val">{fmtPhp(fin.budget)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ds-empty">No budgets set for the current semesters.</div>
              )}
            </div>
          </div>

          <div>
            <div className="ds-sec">
              <span className="ds-sec-title">Next Milestones</span>
              <Link className="ds-sec-link" href="/navigator/milestones">
                View all
              </Link>
            </div>
            <div className="ds-card">
              <div className="ds-dl-list">
                {nextMilestones.length === 0 && (
                  <div className="ds-empty">Every milestone is complete.</div>
                )}
                {nextMilestones.map(({ key, name, milestone }) => (
                  <div key={key} className="ds-dl">
                    <span className="ds-dl-icon">
                      <IcnStar size={14} />
                    </span>
                    <div className="ds-dl-body">
                      <div className="ds-dl-title">{milestone.name}</div>
                      <div className="ds-dl-sub">
                        {name}
                        {milestone.sem ? ` · expected ${milestone.sem}` : ''}
                      </div>
                    </div>
                    <span className={`ds-chip ${milestone.state === 'active' ? 'ds-chip--warn' : 'ds-chip--muted'}`}>
                      {milestone.state}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
