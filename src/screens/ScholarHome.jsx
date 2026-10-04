import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api.js';
import { NGS_DATA } from '../../scholars-data.js';
import { ScholarShell } from '../components/ScholarShell.jsx';
import { Sparkline } from '../components/ShellViz.jsx';
import { IcnCamera, IcnChevron } from '../components/ShellIcons.jsx';
import { ScholarChatPanel } from '../components/ScholarChatPanel.jsx';
import { ScholarAuthGate } from '../components/ScholarAuthGate.jsx';
import { CAT_TO_BUCKET } from '../constants.js';
import { useSessionExpired } from '../hooks/useSessionExpired.js';
import { derivePathway } from '../lib/pathway.js';
import { fileToReceiptPayload, setPendingReceipt } from '../lib/pendingReceipt.js';

// All three scholars have real Neon Auth accounts.
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

function buildConfig(key) {
  const s = NGS_DATA.scholars[key] || {};
  return {
    name: s.firstName || key,
    trackCode: s.track || '',
    staticSemKey: s.currentSem || '',
    expensesHref: `/entry?scholar=${key}`,
    staticStatus: s.status || '',
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

// Slim horizontal stepper for the scholar's pathway (see src/lib/pathway.js).
// done = filled gold, current = half-filled ring, future = outline. State is
// also spelled out for screen readers, never colour alone.
function PathwayStrip({ pathway }) {
  const { stages, summary, doneCount } = pathway;
  return (
    <section className="sh-path" aria-label="Your pathway">
      <div className="sh-path-head">
        <h2 className="sh-eyebrow">Your pathway</h2>
        <span className="sh-path-count">
          {doneCount} of {stages.length} done
        </span>
      </div>
      <ol className="sh-stepper">
        {stages.map((st) => (
          <li
            key={st.key}
            className={`sh-st is-${st.state}`}
            aria-current={st.state === 'current' ? 'step' : undefined}
          >
            <span className="sh-st-node" aria-hidden="true">
              {st.state === 'done' && (
                <svg viewBox="0 0 12 12" width="10" height="10">
                  <path
                    d="M2.5 6.2l2.3 2.3 4.7-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span className="sh-st-label">{st.label}</span>
            <span className="sh-sr">
              {st.state === 'done'
                ? ', completed'
                : st.state === 'current'
                  ? ', current stage'
                  : ''}
            </span>
          </li>
        ))}
      </ol>
      <p className="sh-path-line">{summary}</p>
    </section>
  );
}

// Money card — the page's primary action. "Snap receipt" opens the phone
// camera, then hands the photo to the Money page's existing receipt flow
// (ScholarIngestPanel → review card → submit for approval); nothing is saved
// from here.
function MoneyCard({ scholarKey, expensesHref, stage, semBudget, semSpent }) {
  const router = useRouter();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const pct = semBudget > 0 ? Math.round((semSpent / semBudget) * 100) : null;
  const left = Math.max(0, semBudget - semSpent);

  async function onPicked(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      setPendingReceipt(await fileToReceiptPayload(f));
    } catch {
      // Couldn't read the photo: still open the Money page, which has its own
      // upload box to try again.
    }
    router.push(`${expensesHref}&snap=1`);
  }

  return (
    <section className="ds-card sh-money" aria-label="Money">
      <h2 className="sh-eyebrow">This semester</h2>
      {semBudget > 0 ? (
        <>
          <Link className="sh-money-main" href={expensesHref}>
            <span className="sh-money-amt">{fmtPhp(left)}</span>
            <span className="sh-money-left">left this semester</span>
          </Link>
          <span
            className="sh-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, pct)}
            aria-label="Budget used"
          >
            <span
              className={pct >= 100 ? 'is-bad' : pct >= 90 ? 'is-warn' : ''}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </span>
          <div className="sh-money-meta">
            <b>{pct}% used</b>
            <span>
              {fmtPhp(semSpent)} of {fmtPhp(semBudget)}
            </span>
          </div>
        </>
      ) : (
        <div className="sh-money-none">No budget set for {stage}</div>
      )}
      <div className="sh-money-actions">
        <button
          type="button"
          className="sh-btn is-primary"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <IcnCamera size={18} />
          {busy ? 'Preparing…' : 'Snap receipt'}
        </button>
        <Link className="sh-btn" href={expensesHref}>
          + Add
        </Link>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sh-file"
          tabIndex={-1}
          aria-hidden="true"
          onChange={onPicked}
        />
      </div>
    </section>
  );
}

function EvidenceRow({ href, label, sub, value, tone, children }) {
  return (
    <Link className="sh-ev-row" href={href}>
      <span className="sh-ev-main">
        <span className="sh-ev-label">{label}</span>
        <span className={`sh-ev-sub${tone ? ` is-${tone}` : ''}`}>{sub}</span>
      </span>
      {children}
      <span className="sh-ev-val">{value}</span>
      <IcnChevron size={14} className="sh-ev-chev" />
    </Link>
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
        api.get('/bootstrap?tables=scholars,academics,expenses,deadlines,budgets'),
        api.get('/immersion-hours'),
        // Scholars with no pathway have no career_steps rows; treat a failure
        // here as "no recorded steps" rather than sinking the whole dashboard.
        api.get('/career').catch(() => []),
      ]);

      const scholarRow = bootstrap.scholars?.[0] ?? null;
      const liveSem = scholarRow?.current_sem || config.staticSemKey;
      const eng = immersion?.[scholarKey] ?? null;

      const academics = bootstrap.academics || [];
      const expenses = bootstrap.expenses || [];
      const deadlines = bootstrap.deadlines || [];
      const budgets = bootstrap.budgets || [];

      const gradedAcad = academics
        .slice()
        .sort((a, b) => b.id - a.id)
        .find((a) => a.gpa != null);
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
        englishHours: eng?.currentHours ?? null,
        englishTargetHours: eng?.targetHours ?? null,
        englishStatus: eng?.status ?? null,
        hasImmersionAccount: !!eng,
        liveSem,
        investmentTotals,
        semBudget,
        semSpent,
        // A row from Neon is authoritative even when track is NULL ("not on a
        // track", set by the mentor) — only fall back to the static file when
        // there is no row at all.
        track: scholarRow ? scholarRow.track : config.trackCode,
        status: scholarRow ? scholarRow.status : config.staticStatus,
        careerSteps: Array.isArray(career) ? career : [],
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

  // Pathway: derived from real data only (src/lib/pathway.js). null = not on a
  // track, so the strip is omitted entirely. Not drawn until the live row has
  // loaded — the static file's track could be stale.
  const liveTrack = liveData && 'track' in liveData ? liveData.track : config.trackCode;
  const pathway = liveData
    ? derivePathway({
        track: liveTrack,
        status: liveData.status ?? config.staticStatus,
        currentSem: liveSem,
        careerSteps: liveData.careerSteps,
      })
    : null;

  // English immersion
  const engDisplay = (() => {
    if (!liveData?.hasImmersionAccount) return null;
    const h = liveData.englishHours;
    return h % 1 === 0 ? String(h) : h.toFixed(1);
  })();

  const semBudget = liveData?.semBudget || 0;
  const semSpent = liveData?.semSpent || 0;

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

  return (
    <ScholarShell
      scholarKey={scholarKey}
      name={config.name}
      active="overview"
      identityRole={`${(typeof liveTrack === 'string' && liveTrack) || 'Scholar'} · ${liveStage}`}
      onSignOut={() => {
        setSessionExpired(false);
        setAuthed(false);
      }}
    >
      <div className="sh">
        <header className="sh-greet">
          <div className="ds-topbar-eyebrow">{getGreeting()}</div>
          <h1 className="sh-name">{config.name}</h1>
        </header>

        {pathway && <PathwayStrip pathway={pathway} />}

        <div className="sh-grid">
          <MoneyCard
            scholarKey={scholarKey}
            expensesHref={config.expensesHref}
            stage={liveStage}
            semBudget={semBudget}
            semSpent={semSpent}
          />

          <section className="ds-card sh-panel sh-evidence" aria-label="Progress">
            <h2 className="sh-eyebrow">Progress</h2>
            <EvidenceRow
              href={`/grades/${scholarKey}`}
              label={`GPA${liveData?.latestGpaSem ? ` · ${liveData.latestGpaSem}` : ''}`}
              value={latestGpa != null ? `${latestGpa.toFixed(1)}%` : '—'}
              tone={latestGpa == null ? null : latestGpa >= gpaFloor ? 'good' : 'bad'}
              sub={
                latestGpa == null
                  ? 'No grades recorded yet'
                  : latestGpa >= gpaFloor
                    ? `+${(latestGpa - gpaFloor).toFixed(1)} over the ${gpaFloor}% floor`
                    : `${(gpaFloor - latestGpa).toFixed(1)} under the ${gpaFloor}% floor`
              }
            >
              <Sparkline
                values={(liveData?.gpaPoints || []).map((p) => p.gpa)}
                width={64}
                height={22}
              />
            </EvidenceRow>

            {!isExpensesOnly && (
              <EvidenceRow
                href={`/english/${scholarKey}`}
                label="English"
                value={engDisplay != null ? `${engDisplay} h` : '—'}
                tone={liveData?.englishStatus === 'AT_RISK' ? 'bad' : null}
                sub={
                  liveData?.hasImmersionAccount
                    ? [
                        liveData.englishTargetHours
                          ? `of ${liveData.englishTargetHours} h target`
                          : 'Logged in Immersion',
                        ENG_STATUS[liveData.englishStatus],
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : 'No Immersion account linked yet'
                }
              />
            )}

            {isExpensesOnly && (
              <div className="sh-ev-row is-static">
                <span className="sh-ev-main">
                  <span className="sh-ev-label">Invested in you</span>
                  <span className="sh-ev-sub">Since you joined the program</span>
                </span>
                <span className="sh-ev-val">{inv ? fmtPhpShort(inv.total) : '—'}</span>
              </div>
            )}
          </section>

          <section className="ds-card sh-panel sh-upcoming" aria-label="Coming up">
            <h2 className="sh-eyebrow">Coming up</h2>
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
          </section>

          <section className="ds-card sh-panel sh-recent" aria-label="Recent expenses">
            <h2 className="sh-eyebrow">
              Recent expenses
              <Link className="sh-all" href={config.expensesHref}>
                All expenses →
              </Link>
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
          </section>
        </div>
      </div>
      {/* The one floating AI entry point on this page. Fixed launcher, so it
          sits outside the page grid; on phones it floats above the bottom tab
          bar and .ds-content reserves space for both. */}
      <ScholarChatPanel scholarKey={scholarKey} />
    </ScholarShell>
  );
}
