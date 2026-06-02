import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/navigator.css';
import { NGS_DATA } from '../scholars-data.js';

if (!NGS_DATA || !NGS_DATA.config) {
  throw new Error('NGS_DATA missing — hard-refresh (Ctrl/Cmd+Shift+R)');
}

const D = NGS_DATA;
const SCHOLAR_KEYS = ['claire', 'april', 'aljane'].filter(k => D.scholars[k]);
const NAMECLASS = { Claire: '', April: 't-april', Aljane: 't-aljane' };

// ── utilities ────────────────────────────────────────────────────────────────

function fmt(amount, currency) {
  if (amount == null) return '—';
  if (currency === 'USD') return '$' + Math.round(amount / D.config.exchangeRate).toLocaleString('en-US');
  return '₱' + Math.round(amount).toLocaleString('en-US');
}

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

function allExpenses(s) {
  const out = [];
  Object.keys(s.expenses || {}).forEach(sem =>
    (s.expenses[sem] || []).forEach(e => out.push({ ...e, sem, status: e.avb }))
  );
  return out;
}

function scholarTotals(s) {
  const university = allExpenses(s).reduce((t, e) => t + (e.avb === 'Actual' ? (e.amount || 0) : 0), 0);
  const milestones = (s.milestones || []).reduce((t, m) => t + (m.state === 'done' ? (m.amountPhp || 0) : 0), 0);
  const travel = (s.travels || []).reduce((t, v) => t + ((v.state === 'done' || v.state === 'booked') ? (v.amountPhp || 0) : 0), 0);
  const allocated = Object.values(s.budgets || {}).reduce((t, v) => t + (typeof v === 'number' ? v : 0), 0);
  return { university, milestones, travel, total: university + milestones + travel, allocated };
}

function nextMilestone(s) {
  const f = (s.milestones || []).find(m => m.state !== 'done');
  if (!f) return { name: 'All milestones complete', detail: '—' };
  return { name: f.name, detail: f.sem ? 'Expected · ' + f.sem : 'Upcoming' };
}

function accentFor(s) {
  return s.status === 'active' ? 'gold' : s.status === 'trial' ? 'navy' : 'muted';
}

// ── alert & action generators ─────────────────────────────────────────────────

function safeId(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Maps a semester label to a sortable number so we can compare "is this sem past?"
function semToOrder(sem) {
  if (!sem) return 9999;
  if (/^post/i.test(sem)) return 99999;
  const y = sem.match(/^(\d{4})$/);
  if (y) return (parseInt(y[1]) - 2020) * 1000;
  const m = sem.match(/[Yy](\d+)(?:[Ss](\d+))?/);
  if (m) return parseInt(m[1]) * 100 + (m[2] ? parseInt(m[2]) * 10 : 0);
  if (/G12/i.test(sem)) return 45;
  if (/G11/i.test(sem)) return 25;
  return 10;
}

function generateAlerts(data) {
  const alerts = [];

  Object.entries(data.scholars).forEach(([key, scholar]) => {
    const floor = scholar.gpaFloor;

    (scholar.academics || []).forEach(sem => {
      // GPA alerts — skip already-confirmed-good and excluded semesters
      if (sem.gpa != null && floor != null && sem.status !== 'good' && sem.status !== 'excluded') {
        if (sem.gpa < floor) {
          alerts.push({
            id: `gpa-${key}-${safeId(sem.sem)}`,
            severity: 'critical',
            icon: '🔴',
            scholar: scholar.firstName,
            title: `${scholar.firstName} GPA below floor — ${sem.sem}`,
            sub: `GPA ${sem.gpa.toFixed(2)}% is below the ${floor}% floor. Immediate review required.`,
          });
        } else if (sem.gpa < floor + 2) {
          alerts.push({
            id: `gpa-warn-${key}-${safeId(sem.sem)}`,
            severity: 'amber',
            icon: '⚠️',
            scholar: scholar.firstName,
            title: `${scholar.firstName} GPA watch — ${sem.sem}`,
            sub: `GPA ${sem.gpa.toFixed(2)}% is within 2 points of the ${floor}% floor.`,
          });
        }
      }
      // Pending grade — active semester with no recorded GPA
      if (sem.gpa == null && sem.status === 'active') {
        alerts.push({
          id: `grade-pending-${key}-${safeId(sem.sem)}`,
          severity: 'blue',
          icon: '🔵',
          scholar: scholar.firstName,
          title: `${scholar.firstName} ${sem.sem} grade not yet confirmed`,
          sub: `${sem.sem} grade has not been recorded yet.`,
        });
      }
    });

    // Booked travel reminder
    (scholar.travels || []).forEach(travel => {
      if (travel.state === 'booked') {
        alerts.push({
          id: `travel-booked-${key}-${safeId(travel.dest)}`,
          severity: 'blue',
          icon: '🔵',
          scholar: scholar.firstName,
          title: `${travel.dest} confirmed — ${travel.sem}`,
          sub: `${scholar.firstName}'s ${travel.dest} trip is booked. Verify standing before departure.`,
        });
      }
    });
  });

  // Deadline alerts — urgency 'now' or 'soon'
  (data.deadlines || []).forEach(dl => {
    if (dl.urgency === 'now' || dl.urgency === 'soon') {
      const firstName = (data.scholars[dl.scholar] || {}).firstName || dl.scholar;
      alerts.push({
        id: `deadline-${safeId(dl.event)}`,
        severity: 'blue',
        icon: '🔵',
        scholar: firstName,
        title: dl.event,
        sub: `${dl.event} — ${dl.when}.`,
      });
    }
  });

  return alerts;
}

function generateActions(data) {
  const actions = [];

  Object.entries(data.scholars).forEach(([key, scholar]) => {
    // Grade confirmation for active semesters awaiting a result
    (scholar.academics || []).forEach(sem => {
      if (sem.gpa == null && sem.status === 'active') {
        actions.push({
          id: `action-grade-${key}-${safeId(sem.sem)}`,
          text: `Confirm ${scholar.firstName} ${sem.sem} semester grade when released`,
          scholar: scholar.firstName,
          cat: 'Academic',
        });
      }
    });

    // Milestone unlock — first pending milestone whose target sem has arrived
    const firstPending = (scholar.milestones || []).find(m => m.state !== 'done');
    if (firstPending && scholar.currentSem && semToOrder(firstPending.sem) <= semToOrder(scholar.currentSem)) {
      actions.push({
        id: `action-milestone-${key}-${safeId(firstPending.name)}`,
        text: `Unlock ${firstPending.name} milestone for ${scholar.firstName}`,
        scholar: scholar.firstName,
        cat: 'Milestone',
      });
    }

    // Booked travel — confirm details
    (scholar.travels || []).forEach(travel => {
      if (travel.state === 'booked') {
        actions.push({
          id: `action-travel-${key}-${safeId(travel.dest)}`,
          text: `Verify ${scholar.firstName} standing and confirm ${travel.dest} travel details`,
          scholar: scholar.firstName,
          cat: 'Travel',
        });
      }
    });
  });

  // Imminent deadlines (urgency 'now') become action items
  (data.deadlines || []).forEach(dl => {
    if (dl.urgency === 'now') {
      const firstName = (data.scholars[dl.scholar] || {}).firstName || dl.scholar;
      actions.push({
        id: `action-deadline-${safeId(dl.event)}`,
        text: `Act on: ${dl.event} — ${dl.when}`,
        scholar: firstName,
        cat: dl.cat || 'Academic',
      });
    }
  });

  return actions;
}

// ── lock screen ──────────────────────────────────────────────────────────────

function LockScreen({ isHiding, onUnlock }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    document.body.style.overflow = isHiding ? '' : 'hidden';
  }, [isHiding]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (value === D.config.password) {
      onUnlock();
    } else {
      setError(true);
      inputRef.current?.select();
    }
  }

  return (
    <div id="lock" className={isHiding ? 'is-hidden' : ''}>
      <div className="lock-bg" />
      <div className="lock-inner">
        <div className="lock-badge"><span>N</span><span>G</span><span>S</span></div>
        <h1 className="lock-title">Pathway <em>Navigator</em></h1>
        <div className="lock-sub">Mentor access only</div>
        <form className={`lock-form${error ? ' is-error' : ''}`} onSubmit={handleSubmit} autoComplete="off">
          <input
            ref={inputRef}
            className="lock-input"
            type="password"
            placeholder="Enter passphrase"
            aria-label="Passphrase"
            value={value}
            onChange={e => { setValue(e.target.value); setError(false); }}
          />
          <div className={`lock-err${error ? ' show' : ''}`}>Incorrect passphrase — try again.</div>
          <button className="lock-btn" type="submit">Unlock dashboard</button>
        </form>
        <div className="lock-hint">Private operations console · NextGen Scholars · Phase 1</div>
      </div>
    </div>
  );
}

// ── nav ──────────────────────────────────────────────────────────────────────

function NavBar({ currency, onCurrencyChange }) {
  return (
    <header className="nav">
      <div className="nav-inner">
        <a className="nav-brand" href="index.html">
          <span className="ngs-mark"><span>N</span><span>G</span><span>S</span></span>
          <span className="nav-name">Pathway Navigator</span>
        </a>
        <div className="nav-right">
          <div className="nav-toggle">
            {['PHP', 'USD'].map(cur => (
              <button key={cur} className={currency === cur ? 'active' : ''} onClick={() => onCurrencyChange(cur)}>
                {cur === 'PHP' ? 'PHP ₱' : 'USD $'}
              </button>
            ))}
          </div>
          <span className="nav-badge">Mentor View</span>
          <a className="nav-back" href="index.html">← All scholars</a>
        </div>
      </div>
    </header>
  );
}

// ── alerts ───────────────────────────────────────────────────────────────────

function AlertItem({ alert: a, onDismiss }) {
  const [dismissing, setDismissing] = useState(false);

  function handleDismiss() {
    setDismissing(true);
    setTimeout(onDismiss, 400);
  }

  return (
    <div className={`alert ${a.severity}${dismissing ? ' dismissing' : ''}`}>
      <div className="alert-icon">{a.icon}</div>
      <div className="alert-body">
        <div className="alert-title">{a.title}</div>
        <div className="alert-sub">{a.sub}</div>
      </div>
      <div className="alert-meta">
        <span className={`scholar-tag ${NAMECLASS[a.scholar] || ''}`}>{a.scholar}</span>
        <button className="alert-x" aria-label="Dismiss" onClick={handleDismiss}>×</button>
      </div>
    </div>
  );
}

function AlertsSection({ alerts, onDismiss }) {
  const live = alerts.filter(a => !a._dismissed);
  return (
    <section className="section">
      <div className="eyebrow"><span className="num">01</span> Escalations &amp; Alerts <span className="eyebrow-rule" /></div>
      <div className="section-head">
        <h2 className="section-title">What needs attention</h2>
        <span className="section-note">Dismiss as you resolve each item.</span>
      </div>
      <div className="alert-list">
        {live.length === 0
          ? <div className="alert-empty"><span className="check">✓</span>All clear — no open escalations.</div>
          : live.map(a => <AlertItem key={a.id} alert={a} onDismiss={() => onDismiss(a.id)} />)
        }
      </div>
    </section>
  );
}

// ── status cards ─────────────────────────────────────────────────────────────

function ProgBar({ pct }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(pct));
    return () => cancelAnimationFrame(id);
  }, []);
  return <div className="scard-prog-fill" style={{ width: w + '%' }} />;
}

function ScholarCard({ sk, currency, liveGpa }) {
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
            <div className="metric-val">{fmt(tot.total, currency)}</div>
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

function StatusSection({ currency, liveGpa }) {
  return (
    <section className="section">
      <div className="eyebrow"><span className="num">02</span> Scholar Status <span className="eyebrow-rule" /></div>
      <div className="section-head">
        <h2 className="section-title">Three lives in motion</h2>
        <span className="section-note">Live academic &amp; investment snapshot.</span>
      </div>
      <div className="status-grid">
        {SCHOLAR_KEYS.map(k => <ScholarCard key={k} sk={k} currency={currency} liveGpa={liveGpa} />)}
      </div>
    </section>
  );
}

// ── log ───────────────────────────────────────────────────────────────────────

function LogSection({ logs, onLog }) {
  const [scholar, setScholar] = useState(SCHOLAR_KEYS[0]);
  const [type, setType] = useState('GPA');
  const [detail, setDetail] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!detail.trim()) return;
    const s = D.scholars[scholar];
    const ts = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    onLog({ ts, scholar: s.firstName, scholarKey: scholar, type, detail: detail.trim() });
    setDetail('');
  }

  return (
    <section className="section">
      <div className="eyebrow"><span className="num">03</span> Log Update <span className="eyebrow-rule" /></div>
      <div className="section-head">
        <h2 className="section-title">Record an update</h2>
        <span className="section-note">GPA entries below the floor raise an alert automatically.</span>
      </div>
      <div className="log-card">
        <form className="log-form" onSubmit={handleSubmit}>
          <div className="field">
            <label>Scholar</label>
            <select value={scholar} onChange={e => setScholar(e.target.value)}>
              {SCHOLAR_KEYS.map(k => <option key={k} value={k}>{D.scholars[k].firstName}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Type</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              {['GPA', 'Expense', 'Milestone', 'English', 'Travel', 'Alert'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Details</label>
            <input type="text" placeholder="e.g. Y2·S2 midterm GPA 80.4" value={detail} onChange={e => setDetail(e.target.value)} />
          </div>
          <button className="log-btn" type="submit">Log</button>
        </form>
        <div className="log-feed">
          {logs.length === 0
            ? <div className="log-empty">No updates logged this session.</div>
            : logs.slice(0, 5).map((l, i) => (
              <div key={i} className="log-row">
                <span className="log-time">{l.ts}</span>
                <span className={`scholar-tag ${NAMECLASS[l.scholar] || ''}`}>{l.scholar}</span>
                <span className="log-type">{l.type}</span>
                <span className="log-detail">{l.detail}</span>
              </div>
            ))
          }
        </div>
      </div>
    </section>
  );
}

// ── expense dashboard ─────────────────────────────────────────────────────────

function TotalsRow({ s, currency }) {
  const b = scholarTotals(s);
  return (
    <div className="totals-row">
      <div className="total-card lead">
        <div className="total-val">{fmt(b.total, currency)}</div>
        <div className="total-lbl">Total Invested</div>
      </div>
      <div className="total-card">
        <div className="total-val">{fmt(b.university, currency)}</div>
        <div className="total-lbl">Universidad</div>
      </div>
      <div className="total-card">
        <div className="total-val">{fmt(b.milestones, currency)}</div>
        <div className="total-lbl">Milestones</div>
      </div>
      <div className="total-card">
        <div className="total-val">{fmt(b.travel, currency)}</div>
        <div className="total-lbl">Viajes</div>
      </div>
    </div>
  );
}

function ChartSem({ s, currency }) {
  const sems = Object.keys(s.expenses || {});
  const data = sems.map(sem => {
    let actual = 0, budget = 0;
    (s.expenses[sem] || []).forEach(e => { if (e.avb === 'Actual') actual += e.amount; else budget += e.amount; });
    return { sem, actual, budget };
  });
  const max = Math.max(1, ...data.flatMap(d => [d.actual, d.budget]));
  const [ready, setReady] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, []);

  return (
    <>
      <div className="bars">
        {data.map(d => (
          <div key={d.sem} className="bar-group">
            <div className="bar-pair">
              <div className="bar actual" style={{ height: ready ? Math.round(d.actual / max * 100) + '%' : '0%' }}>
                <span className="bar-tip">{fmt(d.actual, currency)}</span>
              </div>
              <div className="bar budget" style={{ height: ready ? Math.round(d.budget / max * 100) + '%' : '0%' }}>
                <span className="bar-tip">{fmt(d.budget, currency)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="bar-xlabels">{data.map(d => <div key={d.sem} className="bar-xlabel">{d.sem}</div>)}</div>
      <div className="legend">
        <div className="legend-item"><span className="legend-swatch actual" />Actual spend</div>
        <div className="legend-item"><span className="legend-swatch budget" />Budgeted / projected</div>
      </div>
    </>
  );
}

function ChartCat({ s, currency }) {
  const totals = {};
  allExpenses(s).forEach(e => { totals[e.cat] = (totals[e.cat] || 0) + e.amount; });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(e => e[1]));
  const [ready, setReady] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, []);

  return (
    <div className="cat-rows">
      {entries.map(([cat, val]) => (
        <div key={cat} className="cat-row">
          <div className="cat-label">{cat}</div>
          <div className="cat-track">
            <div className="cat-fill" style={{ width: ready ? (val / max * 100) + '%' : '0%' }} />
          </div>
          <div className="cat-val">{fmt(val, currency)}</div>
        </div>
      ))}
    </div>
  );
}

function ExpenseSection({ currency }) {
  const [expScholar, setExpScholar] = useState(SCHOLAR_KEYS[0]);
  const [expView, setExpView] = useState('sem');
  const [expSearch, setExpSearch] = useState('');
  const [expSem, setExpSem] = useState('all');

  const s = { ...D.scholars[expScholar], _key: expScholar };
  const sems = Object.keys(s.expenses || {});

  function switchScholar(k) { setExpScholar(k); setExpSem('all'); setExpSearch(''); }

  let rows = allExpenses(s);
  if (expSem !== 'all') rows = rows.filter(r => r.sem === expSem);
  if (expSearch) rows = rows.filter(r => (r.item + ' ' + r.cat).toLowerCase().includes(expSearch.toLowerCase()));
  rows = rows.slice(0, 60);

  return (
    <section className="section">
      <div className="eyebrow"><span className="num">04</span> Expense Dashboard <span className="eyebrow-rule" /></div>
      <div className="section-head"><h2 className="section-title">Where the investment goes</h2></div>
      <div className="exp-controls">
        <div className="tabs">
          {SCHOLAR_KEYS.map(k => (
            <button key={k} className={`tab${expScholar === k ? ' active' : ''}`} onClick={() => switchScholar(k)}>
              {D.scholars[k].firstName}
            </button>
          ))}
        </div>
        <div className="viewtoggle">
          {[['sem', 'By Semester'], ['cat', 'By Category']].map(([v, lbl]) => (
            <button key={v} className={expView === v ? 'active' : ''} onClick={() => setExpView(v)}>{lbl}</button>
          ))}
        </div>
      </div>
      <TotalsRow s={s} currency={currency} />
      <div className="chart-card">
        {expView === 'sem'
          ? <ChartSem key={expScholar + '-sem'} s={s} currency={currency} />
          : <ChartCat key={expScholar + '-cat'} s={s} currency={currency} />
        }
      </div>
      <div className="exp-table-card">
        <div className="exp-toolbar">
          <input type="text" placeholder="Search items…" value={expSearch} onChange={e => setExpSearch(e.target.value)} />
          <select value={expSem} onChange={e => setExpSem(e.target.value)}>
            <option value="all">All semesters</option>
            {sems.map(sem => <option key={sem} value={sem}>{sem}</option>)}
          </select>
        </div>
        <table className="exp">
          <thead><tr>
            <th>Item</th><th>Category</th><th>Date</th><th className="right">Amount</th><th>Status</th>
          </tr></thead>
          <tbody>
            {rows.length === 0
              ? <tr className="exp-none"><td colSpan={5}>No matching expenses.</td></tr>
              : rows.map((r, i) => (
                <tr key={i}>
                  <td><span className="exp-item">{r.item}</span></td>
                  <td><span className="exp-cat">{r.cat}</span></td>
                  <td className="exp-date">{r.date}</td>
                  <td className="right exp-amount">{fmt(r.amount, currency)}</td>
                  <td><span className={`exp-status ${r.status}`}>{r.status}</span></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── deadlines ─────────────────────────────────────────────────────────────────

function DeadlinesSection() {
  const sorted = [...(D.deadlines || [])].sort((a, b) => a.sort - b.sort);
  return (
    <section className="section">
      <div className="eyebrow"><span className="num">05</span> Critical Deadlines <span className="eyebrow-rule" /></div>
      <div className="section-head"><h2 className="section-title">On the calendar</h2></div>
      <div className="dl-card">
        <table className="dl">
          <thead><tr><th>Event</th><th>Scholar</th><th>When</th><th>Category</th><th>Urgency</th></tr></thead>
          <tbody>
            {sorted.map((d, i) => (
              <tr key={i}>
                <td><span className="dl-event">{d.event}</span></td>
                <td><span className={`scholar-tag ${NAMECLASS[d.scholar] || ''}`}>{d.scholar}</span></td>
                <td className="dl-when">{d.when}</td>
                <td className="dl-cat">{d.cat}</td>
                <td><span className={`urg ${d.urgency}`}>{d.urgency}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── actions ───────────────────────────────────────────────────────────────────

function ActionsSection() {
  const [checked, setChecked] = useState({});
  const toggle = id => setChecked(c => ({ ...c, [id]: !c[id] }));
  const actions = generateActions(D);
  const left = actions.length - Object.values(checked).filter(Boolean).length;

  return (
    <section className="section">
      <div className="eyebrow"><span className="num">06</span> Mentor Action Items <span className="eyebrow-rule" /></div>
      <div className="section-head">
        <h2 className="section-title">This week's checklist</h2>
        <span className="section-note">{left} of {actions.length} open</span>
      </div>
      <div className="actions-list">
        {actions.map(a => {
          const done = !!checked[a.id];
          return (
            <div key={a.id} className={`action${done ? ' done' : ''}`} onClick={() => toggle(a.id)}>
              <span className="checkbox">✓</span>
              <span className="action-text">{a.text}</span>
              <span className={`scholar-tag ${NAMECLASS[a.scholar] || ''}`}>{a.scholar}</span>
              <span className="action-cat">{a.cat}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── english pulse ─────────────────────────────────────────────────────────────

function EnglishSection() {
  return (
    <section className="section">
      <div className="eyebrow"><span className="num">07</span> English Development Pulse <span className="eyebrow-rule" /></div>
      <div className="section-head"><h2 className="section-title">From Cebu to the world</h2></div>
      <div className="eng-grid">
        <div className="eng-card">
          <div className="eng-scholar">Claire · Active</div>
          <div className="eng-stage">Stage 3 — English Only in Messenger</div>
          <p className="eng-desc">All mentor chat now happens exclusively in English. Fluency is climbing toward the OET preparation window in the senior years.</p>
          <div className="eng-obs">
            <div className="eng-ob"><span className="eng-dot pos" />Initiates conversations in English without prompting.</div>
            <div className="eng-ob"><span className="eng-dot pos" />Comfortable with clinical and nursing vocabulary.</div>
            <div className="eng-ob"><span className="eng-dot watch" />Spoken confidence still trails written fluency.</div>
            <div className="eng-ob"><span className="eng-dot pending" />ChatGPT Advanced Voice bootcamp queued for Summer Y3.</div>
          </div>
        </div>
        <div className="eng-card">
          <div className="eng-scholar">April · Trial</div>
          <div className="eng-stage">Stage 1 — Foundation</div>
          <p className="eng-desc">Building daily communication habits with the mentor during the trial period. Structured English work begins on university entry.</p>
          <div className="eng-obs">
            <div className="eng-ob"><span className="eng-dot pos" />Responds daily to mentor check-ins.</div>
            <div className="eng-ob"><span className="eng-dot watch" />Mixes Cebuano and English; vocabulary still forming.</div>
            <div className="eng-ob"><span className="eng-dot pending" />Progressive English with mentor starts Year 1.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── footer ────────────────────────────────────────────────────────────────────

function NavFooter() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-mark">
          <span className="ngs-mark on-navy"><span>N</span><span>G</span><span>S</span></span>
          <div className="footer-tag">One generation lifts another.</div>
        </div>
        <div className="footer-fine">
          <span>Pathway Navigator · Mentor View · Phase 1</span>
          <span>Last updated · {D.config.lastUpdated}</span>
        </div>
      </div>
    </footer>
  );
}

// ── root ──────────────────────────────────────────────────────────────────────

function Navigator() {
  const [unlocked, setUnlocked] = useState(false);
  const [currency, setCurrency] = useState('PHP');
  const [alerts, setAlerts] = useState(() => generateAlerts(D).map(a => ({ ...a })));
  const [logs, setLogs] = useState([]);
  const [liveGpa, setLiveGpa] = useState({});

  function handleDismiss(id) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, _dismissed: true } : a));
  }

  function handleLog(entry) {
    setLogs(prev => [entry, ...prev]);
    if (entry.type === 'GPA') {
      const m = entry.detail.match(/(\d{1,3}(?:\.\d+)?)/);
      if (m) {
        const val = parseFloat(m[1]);
        const s = D.scholars[entry.scholarKey];
        setLiveGpa(prev => ({ ...prev, [entry.scholarKey]: val }));
        if (s && val < s.gpaFloor) {
          setAlerts(prev => [{
            id: 'gpa-' + Date.now(),
            severity: 'critical',
            icon: '🔴',
            scholar: s.firstName,
            title: 'GPA below floor — ' + s.firstName,
            sub: `Logged ${val.toFixed(2)}% against a ${s.gpaFloor}% floor. Intervention required.`,
          }, ...prev]);
        }
      }
    }
  }

  return (
    <>
      <LockScreen isHiding={unlocked} onUnlock={() => setUnlocked(true)} />
      <NavBar currency={currency} onCurrencyChange={setCurrency} />
      <main className="wrap">
        <AlertsSection alerts={alerts} onDismiss={handleDismiss} />
        <StatusSection currency={currency} liveGpa={liveGpa} />
        <LogSection logs={logs} onLog={handleLog} />
        <ExpenseSection currency={currency} />
        <DeadlinesSection />
        <ActionsSection />
        <EnglishSection />
      </main>
      <NavFooter />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Navigator />);
