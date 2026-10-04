import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../lib/api.js';
import { useData } from '../context/DataContext.jsx';
import { SEMESTER_OPTIONS } from '../constants.js';
import { TRACK_OPTIONS, TRACK_LABELS, normalizeTrack } from '../lib/pathway.js';
import { allExpenses, daysSinceLastExpense, monthlySpendTrend } from '../utils.js';
import { Sparkline } from './ShellViz.jsx';

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

// GPA series (oldest → newest) for the scholar-card sparkline — pulled from the
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

// One status label per scholar card, most urgent first: a red risk (GPA
// warning or over budget) beats a quiet week, which beats an amber budget.
function cardStatus(r) {
  if (r.risk === 'red') return { cls: 'is-bad', label: 'Needs you' };
  if (r.daysSince != null && r.daysSince >= 7)
    return { cls: 'is-bad', label: `Quiet ${r.daysSince} days` };
  if (r.risk === 'amber') return { cls: 'is-warn', label: 'Watch budget' };
  return { cls: 'is-good', label: 'On track' };
}

const ENG_STATUS = { ON_TRACK: 'On track', AT_RISK: 'At risk', PENDING: 'Pending' };

function daysUntil(sort) {
  return Math.max(0, Math.ceil((new Date(sort) - new Date()) / 86400000));
}

export function MentorHome({
  greeting,
  liveGpa,
  pendingSubmissions = [],
  dbAlerts = [],
  onSemesterChange,
  onTrackChange,
  unlocked = false,
}) {
  const { D, scholarKeys } = useData();
  const [engData, setEngData] = useState({});
  const [career, setCareer] = useState([]);

  // Gated on `unlocked` (AGENTS.md rule): this component mounts behind
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
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  // ── Per-scholar snapshot the cards read ──
  const rows = scholarKeys
    .map((key) => {
      const s = D.scholars[key];
      if (!s) return null;
      const sem = s.currentSem || '';
      const budgetPct = semBudgetPct(s, sem);
      const risk = riskLevel(s, budgetPct);
      // D.deadlines rows use {when, sort} (see api-loader.js / scholars-data.js).
      const nextDl = (D.deadlines || [])
        .filter((d) => (d.scholar === key || !d.scholar) && (d.sort || '') >= today)
        .sort((a, b) => (a.sort || '').localeCompare(b.sort || ''))[0];
      const weekExpenses = allExpenses(s).filter(
        (e) => e.avb === 'Actual' && e.date && e.date >= weekAgo
      );
      return {
        key,
        s,
        sem,
        budgetPct,
        risk,
        nextDl,
        daysSince: daysSinceActivity(s, key, pendingSubmissions),
        stage: pathwayStage(career, key),
        gpa: liveGpa?.[key] ?? null,
        series: gpaSeries(s),
        eng: engData[key],
        week: {
          count: weekExpenses.length,
          total: weekExpenses.reduce((t, e) => t + (e.amount || 0) * (e.qty || 1), 0),
        },
      };
    })
    .filter(Boolean);

  const needYou = rows.filter((r) => cardStatus(r).cls === 'is-bad').length;
  const spentThisMonth = scholarKeys.reduce(
    (t, key) => t + monthlySpendTrend(D.scholars[key]).thisMonth,
    0
  );

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

  const upcoming = (D.deadlines || [])
    .filter((d) => (d.sort || '') >= today)
    .sort((a, b) => (a.sort || '').localeCompare(b.sort || ''))
    .slice(0, 4)
    .map((d) => ({
      ...d,
      days: daysUntil(d.sort),
      who: d.scholar ? D.scholars[d.scholar]?.firstName || d.scholar : 'Program',
    }));

  return (
    <section className="mh">
      <header className="mh-head">
        <div>
          <div className="ds-topbar-eyebrow">{greeting}</div>
          <h1 className="ds-topbar-title">Your scholars</h1>
        </div>
        <p className="mh-summary">
          {fmtPhp(spentThisMonth)} spent this month
          {needYou > 0 && (
            <>
              {' · '}
              <b className="is-bad">
                {needYou} need{needYou === 1 ? 's' : ''} you
              </b>
            </>
          )}
        </p>
      </header>

      <div className="mh-cards">
        {rows.map((r) => {
          const status = cardStatus(r);
          const name = r.s.firstName || r.s.name || r.key;
          const isTesda = r.s.track === 'TESDA';
          return (
            <article
              key={r.key}
              className={`mh-card${status.cls === 'is-bad' ? ' is-flagged' : ''}`}
            >
              <div className="mh-card-head">
                <Link
                  href={`/home/${r.key}`}
                  className="mh-avatar-link"
                  title={`View ${name}'s dashboard`}
                >
                  <span className="ds-avatar mh-avatar">{name[0].toUpperCase()}</span>
                </Link>
                <div className="mh-card-who">
                  <Link href={`/home/${r.key}`} className="mh-name-link">
                    <div className="mh-card-name">{name}</div>
                  </Link>
                  <div className="mh-card-sub">
                    {r.s.track || '—'}
                    {r.stage ? ` · ${r.stage.label}` : ''}
                  </div>
                </div>
                <span className={`mh-status ${status.cls}`}>{status.label}</span>
              </div>

              <label className="mh-sem">
                <span>Semester</span>
                {onSemesterChange ? (
                  <select
                    className="mh-sem-select"
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
                  <b>{SEM_DISPLAY[r.sem] || r.sem || '—'}</b>
                )}
              </label>

              <label className="mh-sem">
                <span>Track</span>
                {onTrackChange ? (
                  <select
                    className="mh-sem-select"
                    aria-label={`${name} program track`}
                    value={normalizeTrack(r.s.track) ?? (r.s.track ? r.s.track : 'none')}
                    onChange={(e) =>
                      onTrackChange(r.key, e.target.value === 'none' ? null : e.target.value)
                    }
                  >
                    {r.s.track && !normalizeTrack(r.s.track) && (
                      <option value={r.s.track}>{r.s.track} (legacy)</option>
                    )}
                    {TRACK_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {TRACK_LABELS[t]}
                      </option>
                    ))}
                    <option value="none">Not on a track</option>
                  </select>
                ) : (
                  <b>{r.s.track || 'Not on a track'}</b>
                )}
              </label>

              {r.stage && (
                <div
                  className="mh-path"
                  style={{ gridTemplateColumns: `repeat(${r.stage.total}, minmax(0, 1fr))` }}
                  aria-label={`Pathway: ${r.stage.passedCount} of ${r.stage.total} steps passed`}
                >
                  {Array.from({ length: r.stage.total }).map((_, i) => (
                    <span
                      key={i}
                      className={
                        i < r.stage.passedCount
                          ? 'is-done'
                          : i === r.stage.passedCount
                            ? 'is-current'
                            : ''
                      }
                    />
                  ))}
                </div>
              )}

              <div className="mh-metrics">
                <div>
                  <span className="mh-metric-lbl">GPA</span>
                  <span className="mh-metric-val">
                    {r.gpa != null ? `${Number(r.gpa).toFixed(1)}%` : '—'}
                  </span>
                  <Sparkline values={r.series} width={84} height={20} />
                </div>
                <div>
                  <span className="mh-metric-lbl">Budget</span>
                  <span
                    className={`mh-metric-val${r.budgetPct >= 100 ? ' is-bad' : r.budgetPct >= 90 ? ' is-warn' : ''}`}
                  >
                    {r.budgetPct != null ? `${r.budgetPct}%` : '—'}
                  </span>
                  {r.budgetPct != null && (
                    <span className="mh-bar">
                      <span
                        className={
                          r.budgetPct >= 100 ? 'is-bad' : r.budgetPct >= 90 ? 'is-warn' : ''
                        }
                        style={{ width: `${Math.min(100, r.budgetPct)}%` }}
                      />
                    </span>
                  )}
                </div>
                <div>
                  <span className="mh-metric-lbl">English</span>
                  <span className="mh-metric-val">
                    {isTesda ? 'n/a' : r.eng ? `${Math.round(r.eng.currentHours)} h` : '—'}
                  </span>
                  <span className="mh-metric-note">
                    {isTesda
                      ? 'Not in track'
                      : r.eng
                        ? ENG_STATUS[r.eng.status] || r.eng.status
                        : 'No Immersion account'}
                  </span>
                </div>
              </div>

              <div className="mh-card-foot">
                {r.nextDl ? (
                  <>
                    Next: {r.nextDl.event} in{' '}
                    <b className={daysUntil(r.nextDl.sort) <= 7 ? 'is-bad' : ''}>
                      {daysUntil(r.nextDl.sort)} days
                    </b>
                  </>
                ) : (
                  'Nothing on the calendar'
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mh-lower">
        <div className="ds-card mh-panel">
          <h2 className="mh-panel-title">Needs attention</h2>
          {attentionItems.length === 0 && (
            <div className="ds-empty">Nothing needs you right now.</div>
          )}
          {attentionItems.slice(0, 4).map((item, i) => (
            <div key={i} className="mh-attn">
              <span className={`mh-sev${item.severity === 'critical' ? ' is-bad' : ' is-warn'}`}>
                {item.severity === 'critical' ? 'Critical' : 'Watch'}
              </span>
              <span className="mh-attn-text">
                {item.title}
                {item.sub && <span className="mh-attn-sub"> — {item.sub}</span>}
              </span>
              <Link className="mh-link" href={item.href}>
                {item.actionLabel}
              </Link>
            </div>
          ))}
        </div>

        <div className="ds-card mh-panel">
          <h2 className="mh-panel-title">This week</h2>
          {rows.map((r) => (
            <div key={r.key} className={`mh-row${r.week.count === 0 ? ' is-muted' : ''}`}>
              <span>
                {r.s.firstName || r.key} ·{' '}
                {r.week.count === 0
                  ? 'no expenses'
                  : `${r.week.count} expense${r.week.count !== 1 ? 's' : ''}`}
              </span>
              <b>{r.week.count ? fmtPhp(r.week.total) : '—'}</b>
            </div>
          ))}
        </div>

        <div className="ds-card mh-panel">
          <h2 className="mh-panel-title">
            Coming up
            <Link className="mh-link" href="/navigator/deadlines">
              Calendar →
            </Link>
          </h2>
          {upcoming.length === 0 && <div className="ds-empty">Nothing on the calendar.</div>}
          {upcoming.map((d, i) => (
            <div key={d.id ?? i} className="mh-row">
              <span>
                {d.who} · {d.event}
              </span>
              <b className={d.days <= 7 ? 'is-bad' : 'mh-days'}>{d.days} days</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
