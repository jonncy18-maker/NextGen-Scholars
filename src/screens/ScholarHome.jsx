import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api.js';
import { NGS_DATA } from '../../scholars-data.js';
import { Sidebar } from '../components/Sidebar.jsx';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { Ring, Donut, MiniSteps } from '../components/ShellViz.jsx';
import {
  IcnGrid, IcnWallet, IcnBook, IcnGlobe, IcnClock, IcnStar,
  IcnPlane, IcnHome, IcnSignOut, IcnChevron,
} from '../components/ShellIcons.jsx';
import { ScholarChatPanel } from '../components/ScholarChatPanel.jsx';
import { PublicAskWidget } from '../components/PublicAskWidget.jsx';
import { ScholarAuthGate } from '../components/ScholarAuthGate.jsx';
import { SignOutButton } from '../components/SignOutButton.jsx';
import { CAT_TO_BUCKET } from '../constants.js';
import { useSessionExpired } from '../hooks/useSessionExpired.js';

// All three scholars now have real Neon Auth accounts (see CLAUDE.md).
// app/home/[scholar]/page.jsx passes scholarKey straight from the URL with
// no server-side whitelist, so anything outside this set redirects home
// instead of falling through to a scholar dashboard for a key that doesn't
// exist (used to fall through to a cosmetic Supabase-backed gate here).
const KNOWN_SCHOLARS = new Set(['claire', 'april', 'janndilyne']);

const SEM_LABELS = {
  Y1S1: 'Year 1 · Semester 1',
  Y1S2: 'Year 1 · Semester 2',
  Y2S1: 'Year 2 · Semester 1',
  Y2S2: 'Year 2 · Semester 2',
  Y3S1: 'Year 3 · Semester 1',
  Y3S2: 'Year 3 · Semester 2',
  Y4S1: 'Year 4 · Semester 1',
  Y4S2: 'Year 4 · Semester 2',
  TG11S1: 'Grade 11 · Semester 1',
  TG11S2: 'Grade 11 · Semester 2',
  TG12S1: 'Grade 12 · Semester 1',
  TG12S2: 'Grade 12 · Semester 2',
};

// Mirrors CareerSection.jsx / MentorHome.jsx — nursing-track licensure
// pipeline, rendered as the "Your Journey" stepper.
const CAREER_STEPS = ['PNLE', 'OET', 'NCLEX', 'OSCE', 'AHPRA'];
const CAREER_LABELS = {
  PNLE: 'Nursing Licensure',
  OET: 'OET English',
  NCLEX: 'NCLEX',
  OSCE: 'OSCE',
  AHPRA: 'AHPRA Registration',
};

// tagline is portal copy — stage and englishTarget now come from live Neon data
const CONFIGS = {
  claire: {
    tagline: (
      <>
        Four semesters to clear — <em>steady as you go.</em>
      </>
    ),
  },
  april: {
    tagline: (
      <>
        Trial period in progress — <em>one step at a time.</em>
      </>
    ),
  },
};

function buildConfig(key) {
  const s = NGS_DATA.scholars[key] || {};
  return {
    name: s.firstName || key,
    track: s.publicProfile?.trackName || s.track || '',
    trackCode: s.track || '',
    staticSemKey: s.currentSem || '',
    expensesHref: `/entry?scholar=${key}`,
    ...(CONFIGS[key] || {}),
  };
}

function fmtPhpShort(n) {
  if (!n) return '₱0';
  if (n >= 1000000) return '₱' + (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return '₱' + Math.round(n / 1000) + 'K';
  return '₱' + Math.round(n).toLocaleString('en-US');
}

function fmtPhp(n) {
  return '₱' + Math.round(n).toLocaleString('en-US');
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// GPA trend line (scholar academic overview). Renders the last ≤8 graded
// sems as a polyline with the scholar's GPA floor as a dashed reference.
// Fixed-ratio viewBox (no preserveAspectRatio="none") so the point markers
// stay round and the floor's dash pattern doesn't stretch.
function GpaTrend({ points, floor }) {
  if (!points || points.length < 2) return null;
  const vals = points.map((p) => p.gpa);
  const min = Math.min(...vals, floor) - 1;
  const max = Math.max(...vals, floor) + 1;
  const span = max - min || 1;
  const W = 640;
  const H = 180;
  const pad = 16;
  const step = (W - pad * 2) / (points.length - 1);
  const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2);
  const coords = points.map((p, i) => `${(pad + i * step).toFixed(1)},${y(p.gpa).toFixed(1)}`);
  return (
    <>
      <svg
        className="ds-trend-chart"
        viewBox={`0 0 ${W} ${H}`}
        style={{ maxHeight: 150 }}
      >
        {floor >= min && floor <= max && (
          <line className="ds-trend-floor" x1="0" x2={W} y1={y(floor)} y2={y(floor)} />
        )}
        <polyline className="ds-trend-line" points={coords.join(' ')} />
        {points.map((p, i) => (
          <circle key={i} className="ds-trend-dot" cx={pad + i * step} cy={y(p.gpa)} r="5" />
        ))}
      </svg>
      <div className="ds-trend-labels">
        {points.map((p, i) => (
          <div key={i} className="ds-trend-tick">
            <div className="ds-trend-tick-sem">{p.sem}</div>
            <div className="ds-trend-tick-val">{p.gpa.toFixed(1)}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export function ScholarHome({ scholarKey }) {
  const router = useRouter();
  const config = buildConfig(scholarKey);
  const [authed, setAuthed] = useState(false);
  // True only when a re-lock was forced by a dead session, not the normal
  // first-visit case — shown as an explanatory banner on ScholarAuthGate.
  const [sessionExpired, setSessionExpired] = useState(false);
  const [liveData, setLiveData] = useState(null);

  // Central "this call got a 401 that didn't recover" signal (src/lib/api.js).
  // Re-lock instead of leaving this screen silently showing whatever it
  // loaded before the session died (or, worse, the blank {} fallback below).
  useSessionExpired(() => {
    if (!authed) return;
    setSessionExpired(true);
    setAuthed(false);
    setLiveData(null);
  });

  // Janndilyne is a TESDA expenses-only dashboard: no English goals, and no
  // career/vacation/reward trackers — journey/OET cards and their sidebar
  // links are hidden.
  const isExpensesOnly = scholarKey === 'janndilyne';

  const isKnownScholar = KNOWN_SCHOLARS.has(scholarKey);

  useEffect(() => {
    if (!isKnownScholar) router.replace('/');
  }, [isKnownScholar, router]);

  // Gated on `authed` — same as every other scholar screen (EnglishTracking,
  // GradeEntry, VacationTracker, MilestonesTracker). Effects run on mount
  // regardless of what the render returns, so without this guard the fetch
  // fired while the sign-in form was still showing, authenticated with
  // whatever session cookie the browser already carried (i.e. the previously
  // signed-in scholar's), and parked *that* scholar's data in state. Signing
  // in then unlocked the dashboard onto the stale data, and nothing re-ran
  // the effect — which is exactly the "wrong scholar's numbers until a
  // refresh" bug. Fetching only after ScholarAuthGate has verified via
  // /api/me that the session matches this scholarKey guarantees the token
  // used here belongs to the scholar being viewed.
  useEffect(() => {
    if (!isKnownScholar || !authed) return;
    async function loadFromNeon() {
      const [bootstrap, immersion, career] = await Promise.all([
        api.get('/bootstrap?tables=scholars,academics,milestones,travels,expenses,deadlines,budgets'),
        api.get('/immersion-hours'),
        // TESDA scholars have no career_steps rows; treat a failure here as
        // "no journey data" rather than sinking the whole dashboard.
        api.get('/career').catch(() => []),
      ]);

      const liveSem = bootstrap.scholars?.[0]?.current_sem || config.staticSemKey;
      const eng = immersion?.[scholarKey] ?? null;

      const academics = bootstrap.academics || [];
      const milestones = bootstrap.milestones || [];
      const travels = bootstrap.travels || [];
      const expenses = bootstrap.expenses || [];
      const deadlines = bootstrap.deadlines || [];
      const budgets = bootstrap.budgets || [];

      const latestExpense = expenses.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      const gradedAcad = academics
        .slice()
        .sort((a, b) => b.id - a.id)
        .find((a) => a.gpa != null);
      const doneMilestones = milestones.filter((m) => m.state === 'done');
      const nextMilestone =
        milestones.filter((m) => m.state !== 'done').sort((a, b) => a.id - b.id)[0] || null;
      const nextTravel =
        travels.filter((t) => t.state !== 'done').sort((a, b) => a.id - b.id)[0] || null;

      const byBucket = {};
      expenses
        .filter((e) => e.avb === 'Actual')
        .forEach((e) => {
          const b = CAT_TO_BUCKET[e.cat] ?? e.bucket ?? 'college';
          byBucket[b] = (byBucket[b] || 0) + (Number(e.amount) || 0) * (Number(e.qty) || 1);
        });
      const invTotal = Object.values(byBucket).reduce((t, v) => t + v, 0);
      const investmentTotals =
        invTotal > 0
          ? {
              total: invTotal,
              college: byBucket.college || 0,
              life: byBucket.life || 0,
              milestone: byBucket.milestone || 0,
              travel: byBucket.travel || 0,
            }
          : null;

      // Current-sem budget health (drives the Financial Health card + donut)
      const budgetRow = budgets.find((b) => b.sem === liveSem);
      const semBudget = budgetRow ? Number(budgetRow.amount_php) || 0 : 0;
      const semSpent = expenses
        .filter((e) => e.avb === 'Actual' && e.sem === liveSem)
        .reduce((t, e) => t + (Number(e.amount) || 0) * (Number(e.qty) || 1), 0);

      // Journey stepper from career_steps (nursing track only)
      const stepStatus = Object.fromEntries(career.map((r) => [r.step, r.status]));
      const journeySteps = career.length
        ? CAREER_STEPS.map((step) => ({
            step,
            label: CAREER_LABELS[step] || step,
            status: stepStatus[step] || 'pending',
          }))
        : null;

      // GPA history for the trend chart (oldest → newest; raw select order
      // isn't guaranteed, so order by insertion id)
      const gpaPoints = academics
        .filter((a) => a.gpa != null)
        .slice()
        .sort((a, b) => a.id - b.id)
        .map((a) => ({ sem: a.sem, gpa: Number(a.gpa) }))
        .filter((p) => !Number.isNaN(p.gpa))
        .slice(-8);

      const today = new Date().toISOString().slice(0, 10);
      const upcomingDeadlines = deadlines
        .filter((d) => d.sort_date >= today)
        .sort((a, b) => a.sort_date.localeCompare(b.sort_date))
        .slice(0, 5)
        .map((d) => ({
          ...d,
          days: Math.max(0, Math.ceil((new Date(d.sort_date) - new Date()) / 86400000)),
        }));

      return {
        latestExpenseDate: latestExpense?.date ?? null,
        latestGpa: gradedAcad?.gpa != null ? Number(gradedAcad.gpa) : null,
        latestGpaSem: gradedAcad?.sem ?? null,
        gpaStatus: gradedAcad?.status ?? null,
        rewardsCount: doneMilestones.length,
        englishHours: eng?.currentHours ?? null,
        englishTargetHours: eng?.targetHours ?? null,
        englishStatus: eng?.status ?? null,
        hasImmersionAccount: !!eng,
        liveSem,
        investmentTotals,
        nextMilestone,
        nextTravel,
        semBudget,
        semSpent,
        journeySteps,
        gpaPoints,
        upcomingDeadlines,
      };
    }

    loadFromNeon()
      .then(setLiveData)
      .catch(() => setLiveData({}));
  }, [scholarKey, isKnownScholar, authed]);

  const liveSem = liveData?.liveSem || config.staticSemKey;
  const liveStage = SEM_LABELS[liveSem] || liveSem;

  const latestGpa = liveData?.latestGpa ?? null;
  const gpaFloor = NGS_DATA.scholars[scholarKey]?.gpaFloor ?? 81;
  const inv = liveData?.investmentTotals ?? null;
  const nextMil = liveData?.nextMilestone ?? null;

  // Journey progress
  const journey = liveData?.journeySteps ?? null;
  const journeyDone = journey ? journey.filter((s) => s.status === 'passed').length : 0;
  const journeyCurrent = journey ? journey.find((s) => s.status !== 'passed') : null;
  const journeyPct = journey ? Math.round((journeyDone / journey.length) * 100) : null;

  // English immersion
  const engPct =
    liveData?.englishHours != null && liveData?.englishTargetHours
      ? Math.round((liveData.englishHours / liveData.englishTargetHours) * 100)
      : null;
  const engDisplay = (() => {
    if (!liveData?.hasImmersionAccount) return null;
    const h = liveData.englishHours;
    const display = h % 1 === 0 ? String(h) : h.toFixed(1);
    return liveData.englishTargetHours ? `${display} / ${liveData.englishTargetHours}` : display;
  })();

  // Budget health
  const semBudget = liveData?.semBudget || 0;
  const semSpent = liveData?.semSpent || 0;
  const budgetPct = semBudget > 0 ? Math.round((semSpent / semBudget) * 100) : null;
  const budgetHealth =
    budgetPct == null
      ? null
      : budgetPct >= 100
        ? { label: 'Over Budget', cls: 'is-risk' }
        : budgetPct >= 90
          ? { label: 'Watch', cls: 'is-watch' }
          : { label: 'Healthy', cls: '' };

  const lastEntry = liveData?.latestExpenseDate
    ? `Last entry · ${formatDate(liveData.latestExpenseDate)}`
    : 'Tap to add expenses';

  if (!isKnownScholar) return null; // redirecting home, see effect above

  if (!authed) {
    return (
      <ScholarAuthGate
        scholarKey={scholarKey}
        name={config.name}
        onUnlock={() => { setSessionExpired(false); setAuthed(true); }}
        sessionExpired={sessionExpired}
      />
    );
  }

  const navItems = [
    { key: 'overview', href: `/home/${scholarKey}`, label: 'Overview', icon: <IcnGrid size={16} />, active: true },
    { key: 'finances', href: config.expensesHref, label: 'Finances', icon: <IcnWallet size={16} /> },
    { key: 'academics', href: `/grades/${scholarKey}`, label: 'Academics', icon: <IcnBook size={16} /> },
    !isExpensesOnly && { key: 'english', href: `/english/${scholarKey}`, label: 'English (OET)', icon: <IcnGlobe size={16} /> },
    !isExpensesOnly && { key: 'immersion', href: 'https://next-gen-immersion.vercel.app/', label: 'Immersion App', icon: <IcnClock size={16} />, external: true },
    !isExpensesOnly && { key: 'milestones', href: `/milestones/${scholarKey}`, label: 'Milestones', icon: <IcnStar size={16} /> },
    !isExpensesOnly && { key: 'travel', href: `/vacation/${scholarKey}`, label: 'Travel', icon: <IcnPlane size={16} /> },
    { key: 'site', href: '/', label: 'Public Site', icon: <IcnHome size={16} /> },
  ].filter(Boolean);

  return (
    <div className="sp-shell ds-shell">
      <Sidebar
        brand={{ href: `/home/${scholarKey}` }}
        subtitle="Pathway Navigator"
        items={navItems}
        footer={
          <>
            <div className="ds-identity">
              <span className="ds-avatar">{config.name[0]}</span>
              <div>
                <div className="ds-identity-name">{config.name}</div>
                <div className="ds-identity-role">{config.trackCode || 'Scholar'} · {liveStage}</div>
              </div>
            </div>
            <ThemeToggle />
            <SignOutButton
              className="ds-signout"
              onSignOut={() => { setSessionExpired(false); setAuthed(false); }}
            >
              <IcnSignOut size={13} /> Sign out
            </SignOutButton>
          </>
        }
      />
      <div className="ds-main">
        <header className="ds-topbar">
          <div>
            <div className="ds-topbar-eyebrow">
              {config.track}
            </div>
            <h1 className="ds-topbar-title">
              {getGreeting()} {config.name}.
            </h1>
            <div className="ds-topbar-sub">{config.tagline || liveStage}</div>
          </div>
        </header>
        <main className="ds-content">
          {/* ── Stat cards ── */}
          <div className="ds-hero ds-hero--auto">
            {journey && (
              <div className="ds-card ds-card--accent">
                <div className="ds-stat-label">Journey Progress</div>
                <div className="ds-stat-val">
                  {journeyPct}%
                  {journey.some((s) => s.status === 'failed') ? (
                    <span className="ds-stat-trend is-bad">Needs Retake</span>
                  ) : (
                    <span className="ds-stat-trend is-good">On Track</span>
                  )}
                </div>
                <div style={{ marginTop: 10 }}>
                  <MiniSteps total={journey.length} done={journeyDone} />
                </div>
                <div className="ds-stat-sub">
                  {journeyCurrent ? `${journeyCurrent.label} · in progress` : 'Pathway complete'}
                </div>
              </div>
            )}
            <div className={`ds-card${!journey ? ' ds-card--accent' : ''}`}>
              <div className="ds-stat-label">Academic Status</div>
              <div className="ds-stat-val">
                {latestGpa != null ? latestGpa.toFixed(2) : '—'}
                {latestGpa != null && (
                  <span className={`ds-stat-trend ${latestGpa >= gpaFloor ? 'is-good' : 'is-bad'}`}>
                    {latestGpa >= gpaFloor ? 'Above floor' : 'Below floor'}
                  </span>
                )}
              </div>
              <div className="ds-stat-sub">
                {liveData?.latestGpaSem
                  ? `GPA · ${liveData.latestGpaSem} · floor ${gpaFloor}%`
                  : 'No grades recorded yet'}
              </div>
            </div>
            {!isExpensesOnly && (
              <div className="ds-card">
                <div className="ds-stat-label">OET Immersion</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ds-stat-val">{engDisplay ?? '—'}</div>
                    <div className="ds-stat-sub">
                      {liveData?.hasImmersionAccount
                        ? `hours logged${liveData.englishStatus ? ` · ${liveData.englishStatus.replace(/_/g, ' ').toLowerCase()}` : ''}`
                        : 'No Immersion account linked yet'}
                    </div>
                  </div>
                  {engPct != null && (
                    <Ring pct={engPct} size={52} stroke={4.5}>
                      <span style={{ fontFamily: 'var(--ngs-mono)', fontSize: 10 }}>{engPct}%</span>
                    </Ring>
                  )}
                </div>
              </div>
            )}
            <div className="ds-card">
              <div className="ds-stat-label">Financial Health</div>
              {budgetHealth ? (
                <div className={`ds-health ${budgetHealth.cls}`} style={{ display: 'block' }}>
                  <div className="ds-health-status" style={{ fontSize: 22 }}>{budgetHealth.label}</div>
                  <div className="ds-bar" style={{ margin: '10px 0 0' }}>
                    <div
                      className={`ds-bar-fill${budgetPct >= 100 ? ' is-bad' : budgetPct >= 90 ? ' is-warn' : ''}`}
                      style={{ width: `${Math.min(100, budgetPct)}%` }}
                    />
                  </div>
                  <div className="ds-stat-sub">{budgetPct}% of budget used · {liveStage}</div>
                </div>
              ) : inv ? (
                <>
                  <div className="ds-stat-val">{fmtPhpShort(inv.total)}</div>
                  <div className="ds-stat-sub">Total investment in you</div>
                </>
              ) : (
                <>
                  <div className="ds-stat-val">—</div>
                  <div className="ds-stat-sub">No budget set for {liveStage}</div>
                </>
              )}
            </div>
          </div>

          {/* ── Your Journey ── */}
          {journey && (
            <>
              <div className="ds-sec">
                <span className="ds-sec-title">Your Journey</span>
                <Link className="ds-sec-link" href={`/milestones/${scholarKey}`}>
                  View milestones →
                </Link>
              </div>
              <div className="ds-card">
                <div className="ds-journey">
                  {journey.map((s, i) => {
                    const cls =
                      s.status === 'passed'
                        ? 'is-done'
                        : s.status === 'failed'
                          ? 'is-failed'
                          : s === journeyCurrent && s.status !== 'pending'
                            ? 'is-current'
                            : s === journeyCurrent
                              ? 'is-current'
                              : '';
                    return (
                      <div key={s.step} className={`ds-journey-step ${cls}`}>
                        {i < journey.length - 1 && <span className="ds-journey-line" />}
                        <span className="ds-journey-node">
                          {s.status === 'passed' ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4.5 12.5l5 5 10-11" />
                            </svg>
                          ) : (
                            <IcnChevron size={14} />
                          )}
                        </span>
                        <span className="ds-journey-name">{s.label}</span>
                        <span className="ds-journey-state">
                          {s.status === 'passed'
                            ? 'Completed'
                            : s === journeyCurrent
                              ? s.status === 'pending'
                                ? 'Up next'
                                : s.status.replace(/_/g, ' ')
                              : 'Upcoming'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {(nextMil || journeyCurrent) && (
                  <div className="ds-journey-next">
                    <span className="ds-journey-next-lbl">Next Milestone</span>
                    <span className="ds-journey-next-val">
                      {nextMil ? nextMil.name : journeyCurrent?.label}
                      {nextMil?.sem ? ` · expected ${nextMil.sem}` : ''}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="ds-cols">
            <div className="ds-col-main">
              {/* ── Academic overview ── */}
              {liveData?.gpaPoints?.length >= 2 && (
                <>
                  <div className="ds-sec">
                    <span className="ds-sec-title">Academic Overview</span>
                    <Link className="ds-sec-link" href={`/grades/${scholarKey}`}>
                      View details →
                    </Link>
                  </div>
                  <div className="ds-card">
                    <GpaTrend points={liveData.gpaPoints} floor={gpaFloor} />
                  </div>
                </>
              )}

              {/* ── Quick actions ── */}
              <div className="ds-sec">
                <span className="ds-sec-title">Most Used</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <Link className="ds-card" href={config.expensesHref}>
                  <div className="ds-stat-label">Enter Expenses</div>
                  <div className="ds-stat-sub" style={{ marginTop: 2 }}>{lastEntry}</div>
                </Link>
                <Link className="ds-card" href={`/grades/${scholarKey}`}>
                  <div className="ds-stat-label">View Grades</div>
                  <div className="ds-stat-sub" style={{ marginTop: 2 }}>
                    {latestGpa != null
                      ? `GPA ${latestGpa.toFixed(2)} · ${latestGpa >= gpaFloor ? 'above floor' : 'below floor'}`
                      : 'View your record'}
                  </div>
                </Link>
                {!isExpensesOnly && (
                  <Link className="ds-card" href={`/vacation/${scholarKey}`}>
                    <div className="ds-stat-label">Vacation Tracker</div>
                    <div className="ds-stat-sub" style={{ marginTop: 2 }}>
                      {liveData?.nextTravel ? `Next · ${liveData.nextTravel.dest}` : 'Trip log'}
                    </div>
                  </Link>
                )}
                {!isExpensesOnly && (
                  <Link className="ds-card" href={`/milestones/${scholarKey}`}>
                    <div className="ds-stat-label">Rewards Tracker</div>
                    <div className="ds-stat-sub" style={{ marginTop: 2 }}>
                      {nextMil ? `Next · ${nextMil.name}` : `${liveData?.rewardsCount ?? 0} unlocked`}
                    </div>
                  </Link>
                )}
              </div>

              {/* ── AI chat ── */}
              <div className="ds-sec">
                <span className="ds-sec-title">Ask Navigator</span>
              </div>
              <ScholarChatPanel scholarKey={scholarKey} />
            </div>

            <div className="ds-col-rail">
              {/* ── Upcoming deadlines ── */}
              <div>
                <div className="ds-sec">
                  <span className="ds-sec-title">Upcoming Deadlines</span>
                </div>
                <div className="ds-card">
                  <div className="ds-dl-list">
                    {!liveData?.upcomingDeadlines?.length && (
                      <div className="ds-empty">Nothing due — you're all caught up.</div>
                    )}
                    {(liveData?.upcomingDeadlines || []).map((d, i) => (
                      <div key={d.id ?? i} className="ds-dl">
                        <span className={`ds-dl-icon${d.days <= 7 ? ' is-urgent' : ''}`}>
                          <IcnClock size={14} />
                        </span>
                        <div className="ds-dl-body">
                          <div className="ds-dl-title">{d.event}</div>
                          <div className="ds-dl-sub">{d.when_date}</div>
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

              {/* ── Budget overview ── */}
              <div>
                <div className="ds-sec">
                  <span className="ds-sec-title">Budget Overview</span>
                </div>
                <div className="ds-card">
                  {semBudget > 0 ? (
                    <div className="ds-donut-wrap">
                      <Donut
                        size={110}
                        stroke={14}
                        centerVal={`${budgetPct}%`}
                        centerLbl="of budget"
                        segments={[
                          { label: 'Used', value: semSpent, color: 'var(--ngs-gold)' },
                          { label: 'Remaining', value: Math.max(0, semBudget - semSpent), color: 'var(--ngs-blue-nav)' },
                        ]}
                      />
                      <div className="ds-legend">
                        <div className="ds-legend-row">
                          <span className="ds-legend-swatch" style={{ background: 'var(--ngs-gold)' }} />
                          <span className="ds-legend-lbl">Used</span>
                          <span className="ds-legend-val">{fmtPhp(semSpent)}</span>
                        </div>
                        <div className="ds-legend-row">
                          <span className="ds-legend-swatch" style={{ background: 'var(--ngs-blue-nav)' }} />
                          <span className="ds-legend-lbl">Remaining</span>
                          <span className="ds-legend-val">{fmtPhp(Math.max(0, semBudget - semSpent))}</span>
                        </div>
                        <div className="ds-legend-row">
                          <span className="ds-legend-swatch" style={{ background: 'var(--ds-rule)' }} />
                          <span className="ds-legend-lbl">Total · {liveStage}</span>
                          <span className="ds-legend-val">{fmtPhp(semBudget)}</span>
                        </div>
                      </div>
                    </div>
                  ) : inv ? (
                    <div className="ds-legend">
                      {[
                        ['College', inv.college],
                        ['Life', inv.life],
                        ['Milestones', inv.milestone],
                        ['Travel', inv.travel],
                      ].map(([lbl, amt]) => (
                        <div key={lbl} className="ds-legend-row">
                          <span className="ds-legend-swatch" style={{ background: 'var(--ngs-gold)' }} />
                          <span className="ds-legend-lbl">{lbl}</span>
                          <span className="ds-legend-val">{fmtPhpShort(amt)}</span>
                        </div>
                      ))}
                      <div className="ds-legend-row" style={{ fontWeight: 700 }}>
                        <span className="ds-legend-swatch" style={{ background: 'var(--ngs-navy)' }} />
                        <span className="ds-legend-lbl">Total investment</span>
                        <span className="ds-legend-val">{fmtPhpShort(inv.total)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="ds-empty">No budget data yet.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <PublicAskWidget />
        </main>
      </div>
    </div>
  );
}
