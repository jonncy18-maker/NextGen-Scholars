import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api.js';
import { NGS_DATA } from '../../scholars-data.js';
import { ScholarShell } from '../components/ScholarShell.jsx';
import { Sparkline } from '../components/ShellViz.jsx';
import { ScholarChatPanel } from '../components/ScholarChatPanel.jsx';
import { ScholarAuthGate } from '../components/ScholarAuthGate.jsx';
import { CAT_TO_BUCKET } from '../constants.js';
import { useSessionExpired } from '../hooks/useSessionExpired.js';

// All three scholars have real Neon Auth accounts (see CLAUDE.md).
// app/home/[scholar]/page.jsx passes scholarKey straight from the URL with
// no server-side whitelist, so anything outside this set redirects home
// instead of falling through to a scholar dashboard for a key that doesn't
// exist (used to fall through to a cosmetic Supabase-backed gate here).
const KNOWN_SCHOLARS = new Set(['claire', 'april', 'janndilyne', 'demo']);

const SEM_LABELS = {
  Entry: 'Entry (Trial Admission)',
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
// pipeline, rendered as the pathway ring + stage list.
const CAREER_STEPS = ['Trial Period', 'University', 'PNLE', 'OET', 'NCLEX', 'OSCE', 'AHPRA'];
const CAREER_LABELS = {
  'Trial Period': 'Program Trial Admission',
  University: 'College Enrollment',
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
  demo: {
    tagline: (
      <>
        Test account — <em>not a real scholar.</em>
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

const ENG_STATUS = { ON_TRACK: 'On track', AT_RISK: 'At risk', PENDING: 'Pending' };

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Pathway ring: one arc per career step, gold when passed, a softer gold
// for the step in progress, red for a failed attempt. Colors come from
// shell.css (.sh-ring-*) so both themes stay in one place.
function PathwayRing({ steps, current }) {
  const size = 240;
  const r = 100;
  const c = size / 2;
  const gap = 5;
  const span = 360 / steps.length;
  const pt = (deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(c + r * Math.cos(rad)).toFixed(2)} ${(c + r * Math.sin(rad)).toFixed(2)}`;
  };
  const doneCount = steps.filter((st) => st.status === 'passed').length;
  const idx = current ? steps.indexOf(current) + 1 : steps.length;
  return (
    <svg
      className="sh-ring"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Pathway: ${doneCount} of ${steps.length} steps complete`}
    >
      {steps.map((st, i) => {
        const from = i * span + gap / 2;
        const to = (i + 1) * span - gap / 2;
        const cls =
          st.status === 'passed'
            ? 'is-done'
            : st.status === 'failed'
              ? 'is-failed'
              : st === current
                ? 'is-current'
                : '';
        return (
          <path
            key={st.step}
            className={`sh-ring-seg ${cls}`}
            d={`M ${pt(from)} A ${r} ${r} 0 0 1 ${pt(to)}`}
          />
        );
      })}
      <text className="sh-ring-kicker" x={c} y={c - 26} textAnchor="middle">
        {current ? `STEP ${idx} OF ${steps.length}` : 'COMPLETE'}
      </text>
      <text className="sh-ring-step" x={c} y={c + 10} textAnchor="middle">
        {current ? current.step : 'AHPRA'}
      </text>
    </svg>
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
        api.get(
          '/bootstrap?tables=scholars,academics,milestones,travels,expenses,deadlines,budgets'
        ),
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

      const gradedAcad = academics
        .slice()
        .sort((a, b) => b.id - a.id)
        .find((a) => a.gpa != null);
      const doneMilestones = milestones.filter((m) => m.state === 'done');
      const nextMilestone =
        milestones.filter((m) => m.state !== 'done').sort((a, b) => a.id - b.id)[0] || null;

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

      const recentExpenses = expenses
        .filter((e) => e.avb === 'Actual' && e.date)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 3);

      return {
        recentExpenses,
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
  const journeyCurrent = journey ? journey.find((s) => s.status !== 'passed') : null;

  // English immersion
  const engDisplay = (() => {
    if (!liveData?.hasImmersionAccount) return null;
    const h = liveData.englishHours;
    return h % 1 === 0 ? String(h) : h.toFixed(1);
  })();

  // Budget
  const semBudget = liveData?.semBudget || 0;
  const semSpent = liveData?.semSpent || 0;
  const budgetPct = semBudget > 0 ? Math.round((semSpent / semBudget) * 100) : null;
  const budgetLeft = Math.max(0, semBudget - semSpent);

  // Tiles actually rendered below (GPA + Budget always; English for everyone
  // but the expenses-only TESDA scholar; Rewards/Invested always). The grid
  // sizes itself to this so a missing tile never leaves a hole.
  const statCount = isExpensesOnly ? 3 : 4;

  if (!isKnownScholar) return null; // redirecting home, see effect above

  if (!authed) {
    return (
      <ScholarAuthGate
        scholarKey={scholarKey}
        name={config.name}
        onUnlock={() => {
          setSessionExpired(false);
          setAuthed(true);
        }}
        sessionExpired={sessionExpired}
      />
    );
  }

  const stepState = (st) =>
    st.status === 'passed'
      ? 'Completed'
      : st.status === 'failed'
        ? 'Needs retake'
        : st === journeyCurrent
          ? st.status === 'pending'
            ? 'Up next'
            : st.status.replace(/_/g, ' ')
          : 'Upcoming';

  return (
    <ScholarShell
      scholarKey={scholarKey}
      name={config.name}
      active="overview"
      identityRole={`${config.trackCode || 'Scholar'} · ${liveStage}`}
      onSignOut={() => {
        setSessionExpired(false);
        setAuthed(false);
      }}
    >
      <div className="sh">
        <section className="sh-hero">
          <div className="sh-hello">
            <div className="ds-topbar-eyebrow">{getGreeting()}</div>
            <h1 className="sh-name">{config.name}</h1>
            <div className="sh-stage">
              {config.track}
              {liveStage !== config.trackCode && ` · ${liveStage}`}
            </div>
            {!journey && config.tagline && <p className="sh-tagline">{config.tagline}</p>}
          </div>

          {(nextMil || journeyCurrent) && (
            <div className="sh-next">
              <span className="sh-next-lbl">Next milestone</span>
              <span className="sh-next-val">
                {nextMil ? nextMil.name : journeyCurrent?.label}
                {nextMil?.sem ? ` · expected ${nextMil.sem}` : ''}
              </span>
            </div>
          )}

          {journey && (
            <div className="sh-path">
              <PathwayRing steps={journey} current={journeyCurrent} />
              <ol className="sh-steps">
                {journey.map((st) => (
                  <li
                    key={st.step}
                    className={
                      st.status === 'passed'
                        ? 'is-done'
                        : st.status === 'failed'
                          ? 'is-failed'
                          : st === journeyCurrent
                            ? 'is-current'
                            : ''
                    }
                  >
                    <span className="sh-step-dot" />
                    <span className="sh-step-name">{st.label}</span>
                    <span className="sh-step-state">{stepState(st)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <div className="sh-stats" style={{ '--sh-cols': statCount }}>
          <Link className="sh-stat" href={`/grades/${scholarKey}`}>
            <span className="sh-stat-lbl">
              GPA{liveData?.latestGpaSem ? ` · ${liveData.latestGpaSem}` : ''}
            </span>
            <span className="sh-stat-val">
              {latestGpa != null ? `${latestGpa.toFixed(1)}%` : '—'}
            </span>
            <Sparkline
              values={(liveData?.gpaPoints || []).map((p) => p.gpa)}
              width={120}
              height={24}
            />
            <span
              className={`sh-stat-note${latestGpa == null ? '' : latestGpa >= gpaFloor ? ' is-good' : ' is-bad'}`}
            >
              {latestGpa == null
                ? 'No grades recorded yet'
                : latestGpa >= gpaFloor
                  ? `+${(latestGpa - gpaFloor).toFixed(1)} over the ${gpaFloor}% floor`
                  : `${(gpaFloor - latestGpa).toFixed(1)} under the ${gpaFloor}% floor`}
            </span>
          </Link>

          {!isExpensesOnly && (
            <Link className="sh-stat" href={`/english/${scholarKey}`}>
              <span className="sh-stat-lbl">English</span>
              <span className="sh-stat-val">{engDisplay != null ? `${engDisplay} h` : '—'}</span>
              <span className="sh-stat-note">
                {liveData?.hasImmersionAccount
                  ? liveData.englishTargetHours
                    ? `of ${liveData.englishTargetHours} h target`
                    : 'Logged in Immersion'
                  : 'No Immersion account linked yet'}
              </span>
              {liveData?.englishStatus && (
                <span
                  className={`sh-stat-note${liveData.englishStatus === 'AT_RISK' ? ' is-bad' : ' is-good'}`}
                >
                  {ENG_STATUS[liveData.englishStatus] || liveData.englishStatus}
                </span>
              )}
            </Link>
          )}

          <Link className="sh-stat" href={config.expensesHref}>
            <span className="sh-stat-lbl">Budget left</span>
            <span className="sh-stat-val">{semBudget > 0 ? fmtPhpShort(budgetLeft) : '—'}</span>
            {budgetPct != null && (
              <span className="sh-bar">
                <span
                  className={budgetPct >= 100 ? 'is-bad' : budgetPct >= 90 ? 'is-warn' : ''}
                  style={{ width: `${Math.min(100, budgetPct)}%` }}
                />
              </span>
            )}
            <span className="sh-stat-note">
              {semBudget > 0
                ? `${budgetPct}% of ${fmtPhpShort(semBudget)} used`
                : `No budget set for ${liveStage}`}
            </span>
          </Link>

          {isExpensesOnly ? (
            <div className="sh-stat">
              <span className="sh-stat-lbl">Invested in you</span>
              <span className="sh-stat-val">{inv ? fmtPhpShort(inv.total) : '—'}</span>
              <span className="sh-stat-note">Since you joined the program</span>
            </div>
          ) : (
            <Link className="sh-stat" href={`/milestones/${scholarKey}`}>
              <span className="sh-stat-lbl">Rewards</span>
              <span className="sh-stat-val">{liveData?.rewardsCount ?? '—'}</span>
              <span className="sh-stat-note">Unlocked so far</span>
              {nextMil && <span className="sh-stat-note is-accent">Next: {nextMil.name}</span>}
            </Link>
          )}
        </div>

        <div className="sh-lists">
          <div className="ds-card sh-panel">
            <h2 className="sh-panel-title">Coming up</h2>
            {!liveData?.upcomingDeadlines?.length && (
              <div className="ds-empty">Nothing due — you're all caught up.</div>
            )}
            {(liveData?.upcomingDeadlines || []).map((d, i) => (
              <div key={d.id ?? i} className="sh-row">
                <div>
                  <div className="sh-row-title">{d.event}</div>
                  <div className="sh-row-sub">{d.when_date}</div>
                </div>
                <span className={`sh-days${d.days <= 7 ? ' is-bad' : ''}`}>{d.days} days</span>
              </div>
            ))}
          </div>
          <div className="ds-card sh-panel">
            <h2 className="sh-panel-title">
              Recent
              <span className="sh-panel-actions">
                <Link className="sh-add" href={config.expensesHref}>
                  + Add
                </Link>
                <Link className="mh-link" href={config.expensesHref}>
                  All expenses →
                </Link>
              </span>
            </h2>
            {!liveData?.recentExpenses?.length && <div className="ds-empty">No expenses yet.</div>}
            {(liveData?.recentExpenses || []).map((e) => (
              <div key={e.id} className="sh-row">
                <div>
                  <div className="sh-row-title">{e.item || e.cat}</div>
                  <div className="sh-row-sub">
                    {e.cat} · {formatDate(e.date)}
                  </div>
                </div>
                <span className="sh-amt">
                  {fmtPhp((Number(e.amount) || 0) * (Number(e.qty) || 1))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* The one floating AI entry point on this page. (PublicAskWidget, the
          unauthenticated program-FAQ bot, used to stack under it — wrong
          audience for a signed-in page.) Fixed launcher, so it sits outside
          the page grid; .ds-content reserves bottom space for it. */}
      <ScholarChatPanel scholarKey={scholarKey} />
    </ScholarShell>
  );
}
