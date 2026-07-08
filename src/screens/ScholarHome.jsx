import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api.js';
import { NGS_DATA } from '../../scholars-data.js';
import {
  IconExpenses,
  IconGrades,
  IconClock,
  IconIsland,
  IconBriefcase,
  IconTrophy,
  IconMessage,
  IconArrow,
} from '../components/ScholarIcons.jsx';
import { ScholarChatPanel } from '../components/ScholarChatPanel.jsx';
import { PublicAskWidget } from '../components/PublicAskWidget.jsx';
import { ScholarAuthGate } from '../components/ScholarAuthGate.jsx';
import { SignOutButton } from '../components/SignOutButton.jsx';
import { CAT_TO_BUCKET } from '../constants.js';

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
    gradesHref: `/${key}`,
    ...(CONFIGS[key] || {}),
  };
}

function fmtPhpShort(n) {
  if (!n) return '₱0';
  if (n >= 1000000) return '₱' + (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return '₱' + Math.round(n / 1000) + 'K';
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

export function ScholarHome({ scholarKey }) {
  const router = useRouter();
  const config = buildConfig(scholarKey);
  const [authed, setAuthed] = useState(false);
  const [liveData, setLiveData] = useState(null);

  // Janndilyne is a TESDA expenses-only dashboard: no English goals, and no
  // career/vacation/reward trackers. The English stat card is hidden and the
  // investment card spans the full row on mobile.
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
      const [bootstrap, immersion] = await Promise.all([
        api.get('/bootstrap?tables=scholars,academics,milestones,travels,expenses'),
        api.get('/immersion-hours'),
      ]);

      const liveSem = bootstrap.scholars?.[0]?.current_sem || config.staticSemKey;
      const eng = immersion?.[scholarKey] ?? null;

      const academics = bootstrap.academics || [];
      const milestones = bootstrap.milestones || [];
      const travels = bootstrap.travels || [];
      const expenses = bootstrap.expenses || [];

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
          byBucket[b] = (byBucket[b] || 0) + (e.amount || 0) * (e.qty || 1);
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

      return {
        latestExpenseDate: latestExpense?.date ?? null,
        latestGpa: gradedAcad?.gpa != null ? Number(gradedAcad.gpa) : null,
        latestGpaSem: gradedAcad?.sem ?? null,
        gpaStatus: gradedAcad?.status ?? null,
        rewardsCount: doneMilestones.length,
        englishHours: eng?.currentHours ?? null,
        englishTargetHours: eng?.targetHours ?? null,
        hasImmersionAccount: !!eng,
        liveSem,
        investmentTotals,
        nextMilestone,
        nextTravel,
      };
    }

    loadFromNeon()
      .then(setLiveData)
      .catch(() => setLiveData({}));
  }, [scholarKey, isKnownScholar, authed]);

  const lastEntry = liveData?.latestExpenseDate
    ? `Last entry · ${formatDate(liveData.latestExpenseDate)}`
    : 'Tap to add expenses';

  const gpaBlurb =
    liveData?.latestGpa != null ? (
      <>
        GPA <b>{liveData.latestGpa.toFixed(2)}</b> ·{' '}
        {liveData.gpaStatus === 'warn' ? 'near floor' : 'above floor'}
      </>
    ) : (
      'View your record'
    );

  const rewardsCount = liveData?.rewardsCount ?? 0;

  const liveSem = liveData?.liveSem || config.staticSemKey;
  const liveStage = SEM_LABELS[liveSem] || config.stage || liveSem;

  const englishSub = (() => {
    if (!liveData) return 'Tracking hours';
    if (!liveData.hasImmersionAccount) return 'No Immersion account linked yet';
    const h = liveData.englishHours;
    const display = h % 1 === 0 ? String(h) : h.toFixed(1);
    return liveData.englishTargetHours
      ? `${display} / ${liveData.englishTargetHours} hrs`
      : `${display} hrs`;
  })();

  const PRIMARY = [
    {
      key: 'expenses',
      icon: <IconExpenses size={25} />,
      label: 'Enter Expenses',
      blurb: lastEntry,
      href: config.expensesHref,
    },
    {
      key: 'grades',
      icon: <IconGrades size={25} />,
      label: 'View Grades',
      blurb: gpaBlurb,
      href: `/grades/${scholarKey}`,
    },
  ];

  const TRACKERS = [
    {
      key: 'english',
      icon: <IconClock size={19} />,
      label: 'English Hours ↗',
      sub: englishSub,
      href: 'https://next-gen-immersion.vercel.app/',
      external: true,
    },
    {
      key: 'vacation',
      icon: <IconIsland size={19} />,
      label: 'Vacation Tracker',
      sub: liveData?.nextTravel ? `Next · ${liveData.nextTravel.dest}` : 'Trip log',
      href: `/vacation/${scholarKey}`,
    },
    {
      key: 'career',
      icon: <IconBriefcase size={19} />,
      label: 'Career Tracker',
      sub: 'Pathway steps',
      href: null,
    },
    {
      key: 'rewards',
      icon: <IconTrophy size={19} />,
      label: 'Rewards Tracker',
      sub: liveData?.nextMilestone
        ? `Next · ${liveData.nextMilestone.name}`
        : `${rewardsCount} unlocked`,
      reward: true,
      href: `/milestones/${scholarKey}`,
    },
    {
      key: 'messages',
      icon: <IconMessage size={19} />,
      label: 'Messages',
      sub: 'No new messages',
      href: null,
    },
  ].filter(
    (t) => !(isExpensesOnly && ['english', 'vacation', 'career', 'rewards'].includes(t.key))
  );

  const inv = liveData?.investmentTotals ?? null;
  const nextMil = liveData?.nextMilestone ?? null;
  const nextTravel = liveData?.nextTravel ?? null;
  const latestGpa = liveData?.latestGpa ?? null;
  const latestGpaSem = liveData?.latestGpaSem ?? null;
  const scholarStaticGpaFloor = NGS_DATA.scholars[scholarKey]?.gpaFloor ?? 81;

  const englishHoursDisplay = (() => {
    if (!liveData?.hasImmersionAccount) return null;
    const h = liveData.englishHours;
    const display = h % 1 === 0 ? String(h) : h.toFixed(1);
    return liveData.englishTargetHours
      ? `${display} / ${liveData.englishTargetHours} hrs`
      : `${display} hrs`;
  })();

  if (!isKnownScholar) return null; // redirecting home, see effect above

  if (!authed) {
    return (
      <ScholarAuthGate
        scholarKey={scholarKey}
        name={config.name}
        onUnlock={() => setAuthed(true)}
      />
    );
  }

  return (
    <div className="sp-page">
      <div className="sp">
        <header className="sp-head">
          <SignOutButton onSignOut={() => setAuthed(false)} />
          <div className="sp-track">
            <span className="sp-track-dot" />
            {config.track}
            <span className="sp-track-sep">·</span>
            {config.trackCode}
          </div>
          <p className="sp-greet-kicker">{getGreeting()}</p>
          <h1 className="sp-greet-name">{config.name}.</h1>
          {(inv ||
            latestGpa != null ||
            nextMil ||
            nextTravel ||
            (englishHoursDisplay && !isExpensesOnly)) && (
            <div className="sp-stat-cards">
              {inv && (
                <div className={`sp-sc-card${isExpensesOnly ? ' sp-sc-card--full' : ''}`}>
                  <div className="sp-sc-label">Total Investment</div>
                  <div className="sp-sc-val">
                    {'₱' + Math.round(inv.total).toLocaleString('en-US')}
                  </div>
                  <div className="sp-sc-subs">
                    {[
                      ['College', inv.college],
                      ['Life', inv.life],
                      ['Milestones', inv.milestone],
                      ['Travel', inv.travel],
                    ].map(([lbl, amt]) => (
                      <div key={lbl} className="sp-sc-sub">
                        <span>{lbl}</span>
                        <span>{fmtPhpShort(amt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {latestGpa != null && (
                <div className="sp-sc-card">
                  <div className="sp-sc-label">
                    Latest GPA{latestGpaSem ? ` · ${latestGpaSem}` : ''}
                  </div>
                  <div className="sp-sc-val">{latestGpa.toFixed(2)}%</div>
                  <div className="sp-sc-subs">
                    <div
                      className={`sp-sc-sub sp-sc-gpa${latestGpa >= scholarStaticGpaFloor ? ' is-ok' : ' is-warn'}`}
                    >
                      {latestGpa >= scholarStaticGpaFloor
                        ? `Above ${scholarStaticGpaFloor}% floor`
                        : `Below ${scholarStaticGpaFloor}% floor`}
                    </div>
                  </div>
                </div>
              )}
              {nextMil && (
                <div className="sp-sc-card">
                  <div className="sp-sc-label">Next Milestone</div>
                  <div className="sp-sc-val sp-sc-val--sm">{nextMil.name}</div>
                  {nextMil.sem && (
                    <div className="sp-sc-subs">
                      <div className="sp-sc-sub">
                        <span>Expected</span>
                        <span>{nextMil.sem}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {nextTravel && (
                <div className="sp-sc-card">
                  <div className="sp-sc-label">Next Travel Award</div>
                  <div className="sp-sc-val sp-sc-val--sm">{nextTravel.dest}</div>
                  {nextTravel.sem && (
                    <div className="sp-sc-subs">
                      <div className="sp-sc-sub">
                        <span>Expected</span>
                        <span>{nextTravel.sem}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {englishHoursDisplay && !isExpensesOnly && (
                <div className="sp-sc-card">
                  <div className="sp-sc-label">English Hours</div>
                  <div className="sp-sc-val sp-sc-val--sm">{englishHoursDisplay}</div>
                </div>
              )}
            </div>
          )}
          <div className="sp-head-rule" />
          <div className="sp-head-meta">
            <span className="sp-stage">{liveStage}</span>
            <p className="sp-tagline">{config.tagline}</p>
          </div>
        </header>

        <ScholarChatPanel scholarKey={scholarKey} />

        <section className="sp-section">
          <div className="sp-eyebrow">
            <span className="sp-eyebrow-rule" />
            Most used
          </div>
          <div className="sp-primary-grid">
            {PRIMARY.map((card) => (
              <Link key={card.key} className="sp-card" href={card.href}>
                <div className="sp-card-icon">{card.icon}</div>
                <div className="sp-card-arrow">
                  <IconArrow size={16} />
                </div>
                <div className="sp-card-label">{card.label}</div>
                <div className="sp-card-blurb">{card.blurb}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="sp-section is-trackers">
          <div className="sp-eyebrow">
            <span className="sp-eyebrow-rule" />
            Trackers
            <span className="sp-eyebrow-count">{String(TRACKERS.length).padStart(2, '0')}</span>
          </div>
          <div className="sp-tracker-grid">
            {TRACKERS.map((tile) => {
              const inner = (
                <>
                  <div className="sp-tile-icon">{tile.icon}</div>
                  <div className="sp-tile-body">
                    <div className="sp-tile-label">{tile.label}</div>
                    <div className="sp-tile-sub">{tile.sub}</div>
                  </div>
                </>
              );
              if (!tile.href) {
                return (
                  <div
                    key={tile.key}
                    className={`sp-tile sp-tile--inactive${tile.reward ? ' is-reward' : ''}`}
                  >
                    {inner}
                  </div>
                );
              }
              return tile.external ? (
                <a
                  key={tile.key}
                  className={`sp-tile${tile.reward ? ' is-reward' : ''}`}
                  href={tile.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {inner}
                </a>
              ) : (
                <Link
                  key={tile.key}
                  className={`sp-tile${tile.reward ? ' is-reward' : ''}`}
                  href={tile.href}
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </section>

        <PublicAskWidget />

        <footer className="sp-footer">
          <div className="sp-mark">NGS</div>
          <div className="sp-footer-tag">One generation lifts another.</div>
          <Link href="/" className="sp-home-link">
            ← Home
          </Link>
        </footer>
      </div>
    </div>
  );
}
