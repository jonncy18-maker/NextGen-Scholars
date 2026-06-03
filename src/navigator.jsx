import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/navigator.css';
import { NGS_DATA } from '../scholars-data.js';
import { loadFromSheets } from './sheets-loader.js';
import { storedMode, storedRate, persistFx, fetchMarketRate, DEFAULT_RATE } from './fx.js';

if (!NGS_DATA || !NGS_DATA.config) {
  throw new Error('NGS_DATA missing — hard-refresh (Ctrl/Cmd+Shift+R)');
}

let D = NGS_DATA;
const SCHOLAR_KEYS = ['claire', 'april', 'aljane'].filter(k => D.scholars[k]);
const NAMECLASS = { Claire: '', April: 't-april', Aljane: 't-aljane' };

// ── FX context ───────────────────────────────────────────────────────────────

const FxCtx = React.createContext(DEFAULT_RATE);

function useFmt() {
  const rate = React.useContext(FxCtx);
  return (amount, currency) => {
    if (amount == null) return '—';
    if (currency === 'USD') return '$' + Math.round(amount / rate).toLocaleString('en-US');
    return '₱' + Math.round(amount).toLocaleString('en-US');
  };
}

// ── utilities ────────────────────────────────────────────────────────────────

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
  const travel = (s.travels || []).reduce((t, v) => t + (v.state === 'done' ? (v.amountPhp || 0) : 0), 0);
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

function NavBar({ currency, onCurrencyChange, fxMode, fxRate, fxStatus, onFxModeChange, onFxRateChange }) {
  const [inputVal, setInputVal] = useState(String(fxRate));

  useEffect(() => {
    setInputVal(fxRate.toFixed(2));
  }, [fxRate]);

  function handleRateInput(e) {
    setInputVal(e.target.value);
    const n = parseFloat(e.target.value);
    if (!isNaN(n) && n > 0) onFxRateChange(n);
  }

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

          <div className="fx-widget">
            <span className="fx-label">$1 = ₱</span>
            <div className="fx-mode-toggle">
              <button
                className={fxMode === 'market' ? 'active' : ''}
                onClick={() => onFxModeChange('market')}
                title="Fetch live market rate"
              >
                {fxStatus === 'loading' ? '⟳' : 'Market'}
              </button>
              <button
                className={fxMode === 'manual' ? 'active' : ''}
                onClick={() => onFxModeChange('manual')}
                title="Enter rate manually"
              >
                Manual
              </button>
            </div>
            <input
              type="number"
              className={`fx-input${fxMode === 'market' ? ' is-market' : ''}`}
              value={inputVal}
              disabled={fxMode === 'market'}
              min="1"
              max="999"
              step="0.01"
              onChange={handleRateInput}
              title={fxMode === 'market' ? 'Rate set by market — switch to Manual to edit' : 'PHP per 1 USD'}
            />
            {fxStatus === 'error' && <span className="fx-err" title="Could not fetch market rate">!</span>}
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
  const $fmt = useFmt();
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
            <div className="metric-val">{$fmt(tot.total, currency)}</div>
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
  const $fmt = useFmt();
  const b = scholarTotals(s);
  return (
    <div className="totals-row">
      <div className="total-card lead">
        <div className="total-val">{$fmt(b.total, currency)}</div>
        <div className="total-lbl">Total Invested</div>
      </div>
      <div className="total-card">
        <div className="total-val">{$fmt(b.university, currency)}</div>
        <div className="total-lbl">Universidad</div>
      </div>
      <div className="total-card">
        <div className="total-val">{$fmt(b.milestones, currency)}</div>
        <div className="total-lbl">Milestones</div>
      </div>
      <div className="total-card">
        <div className="total-val">{$fmt(b.travel, currency)}</div>
        <div className="total-lbl">Viajes</div>
      </div>
    </div>
  );
}

function ChartSem({ s, currency }) {
  const $fmt = useFmt();
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
                <span className="bar-tip">{$fmt(d.actual, currency)}</span>
              </div>
              <div className="bar budget" style={{ height: ready ? Math.round(d.budget / max * 100) + '%' : '0%' }}>
                <span className="bar-tip">{$fmt(d.budget, currency)}</span>
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
  const $fmt = useFmt();
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
          <div className="cat-val">{$fmt(val, currency)}</div>
        </div>
      ))}
    </div>
  );
}

// ── filter helpers ────────────────────────────────────────────────────────────

const EMPTY_FILTERS = {
  item: '',
  cats: [],
  dateFrom: '',
  dateTo: '',
  amtMin: '',
  amtMax: '',
  statuses: [],
  sents: [],
};

function countActiveFilters(f) {
  return (f.item ? 1 : 0) +
    (f.cats.length ? 1 : 0) +
    (f.dateFrom || f.dateTo ? 1 : 0) +
    (f.amtMin !== '' || f.amtMax !== '' ? 1 : 0) +
    (f.statuses.length ? 1 : 0) +
    (f.sents.length ? 1 : 0);
}

function applyFilters(rows, f) {
  return rows.filter(r => {
    if (f.item && !r.item.toLowerCase().includes(f.item.toLowerCase())) return false;
    if (f.cats.length > 0 && !f.cats.includes(r.cat)) return false;
    if (f.dateFrom && r.date < f.dateFrom) return false;
    if (f.dateTo && r.date > f.dateTo) return false;
    if (f.amtMin !== '' && r.amount < parseFloat(f.amtMin)) return false;
    if (f.amtMax !== '' && r.amount > parseFloat(f.amtMax)) return false;
    if (f.statuses.length > 0 && !f.statuses.includes(r.status)) return false;
    if (f.sents.length > 0 && !f.sents.includes(r.sent)) return false;
    return true;
  });
}

function applySorting(rows, field, dir) {
  if (!field) return rows;
  return [...rows].sort((a, b) => {
    let va, vb;
    if (field === 'item')   { va = a.item   || ''; vb = b.item   || ''; }
    if (field === 'cat')    { va = a.cat    || ''; vb = b.cat    || ''; }
    if (field === 'date')   { va = a.date   || ''; vb = b.date   || ''; }
    if (field === 'amount') { va = a.amount || 0;  vb = b.amount || 0;  }
    if (field === 'status') { va = a.status || ''; vb = b.status || ''; }
    if (field === 'sent')   { va = a.sent   || ''; vb = b.sent   || ''; }
    const cmp = typeof va === 'number' ? va - vb : va.localeCompare(vb);
    return dir === 'asc' ? cmp : -cmp;
  });
}

function SortTh({ label, field, sortField, sortDir, onSort, className }) {
  const active = sortField === field;
  const arrow = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
  return (
    <th
      className={`sortable${active ? ' sort-active' : ''}${className ? ' ' + className : ''}`}
      onClick={() => onSort(field)}
      title={`Sort by ${label}`}
    >
      {label}{arrow}
    </th>
  );
}

// ── filter panel ──────────────────────────────────────────────────────────────

function FilterPanel({ filters, setFilters, uniqueCats, uniqueStatuses, uniqueSents, onClear }) {
  function toggleArr(key, val) {
    setFilters(f => {
      const arr = f[key];
      return { ...f, [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] };
    });
  }

  return (
    <div className="filter-panel">
      <div className="filter-grid">
        <div className="filter-col">
          <div className="filter-label">Item</div>
          <input
            type="text"
            className="filter-text"
            placeholder="Search item name…"
            value={filters.item}
            onChange={e => setFilters(f => ({ ...f, item: e.target.value }))}
          />
        </div>

        <div className="filter-col">
          <div className="filter-label">Category</div>
          <div className="filter-chips">
            {uniqueCats.map(cat => (
              <button
                key={cat}
                className={`filter-chip${filters.cats.includes(cat) ? ' active' : ''}`}
                onClick={() => toggleArr('cats', cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-col">
          <div className="filter-label">Date range</div>
          <div className="filter-range">
            <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
            <span className="filter-range-sep">→</span>
            <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
          </div>
        </div>

        <div className="filter-col">
          <div className="filter-label">Amount (₱)</div>
          <div className="filter-range">
            <input type="number" placeholder="Min" value={filters.amtMin} min="0" onChange={e => setFilters(f => ({ ...f, amtMin: e.target.value }))} />
            <span className="filter-range-sep">→</span>
            <input type="number" placeholder="Max" value={filters.amtMax} min="0" onChange={e => setFilters(f => ({ ...f, amtMax: e.target.value }))} />
          </div>
        </div>

        <div className="filter-col">
          <div className="filter-label">Status</div>
          <div className="filter-chips">
            {uniqueStatuses.map(st => (
              <button
                key={st}
                className={`filter-chip filter-chip-status${filters.statuses.includes(st) ? ' active' : ''}`}
                onClick={() => toggleArr('statuses', st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-col">
          <div className="filter-label">Sent</div>
          <div className="filter-chips">
            {uniqueSents.map(s => (
              <button
                key={s}
                className={`filter-chip${filters.sents.includes(s) ? ' active' : ''}`}
                onClick={() => toggleArr('sents', s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="filter-footer">
        <button className="filter-clear" onClick={onClear}>Clear all filters</button>
      </div>
    </div>
  );
}

// ── expense section ───────────────────────────────────────────────────────────

function ExpenseSection({ currency }) {
  const $fmt = useFmt();

  const [expScholar, setExpScholar] = useState(SCHOLAR_KEYS[0]);
  const [expView, setExpView] = useState('sem');
  const [expSearch, setExpSearch] = useState('');
  const [expSem, setExpSem] = useState('all');

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const s = { ...D.scholars[expScholar], _key: expScholar };
  const sems = Object.keys(s.expenses || {});

  const allRows = allExpenses(s);
  const uniqueCats = [...new Set(allRows.map(r => r.cat))].sort();
  const uniqueStatuses = [...new Set(allRows.map(r => r.status))].sort();
  const uniqueSents = [...new Set(allRows.map(r => r.sent).filter(Boolean))].sort();

  function switchScholar(k) {
    setExpScholar(k);
    setExpSem('all');
    setExpSearch('');
    setFilters(EMPTY_FILTERS);
    setSortField(null);
    setSortDir('asc');
  }

  function handleSort(field) {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortField(null); setSortDir('asc'); }
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setExpSearch('');
    setExpSem('all');
  }

  let rows = allRows;
  if (expSem !== 'all') rows = rows.filter(r => r.sem === expSem);
  if (expSearch) rows = rows.filter(r => (r.item + ' ' + r.cat).toLowerCase().includes(expSearch.toLowerCase()));
  rows = applyFilters(rows, filters);
  rows = applySorting(rows, sortField, sortDir);

  const activeFilters = countActiveFilters(filters) + (expSearch ? 1 : 0) + (expSem !== 'all' ? 1 : 0);

  return (
    <section className="section">
      <div className="eyebrow"><span className="num">04</span> Expense Dashboard <span className="eyebrow-rule" /></div>
      <div className="section-head">
        <h2 className="section-title">Where the investment goes</h2>
        <button
          className={`filter-toggle-btn${showFilters ? ' is-open' : ''}${activeFilters > 0 ? ' has-active' : ''}`}
          onClick={() => setShowFilters(v => !v)}
        >
          {showFilters ? '▲' : '▼'} Filters{activeFilters > 0 ? ` · ${activeFilters} active` : ''}
        </button>
      </div>

      {showFilters && (
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          uniqueCats={uniqueCats}
          uniqueStatuses={uniqueStatuses}
          uniqueSents={uniqueSents}
          onClear={clearFilters}
        />
      )}

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

      {(() => {
        const pendingRows = rows.filter(r => r.sent !== 'Yes');
        const pendingTotal = pendingRows.reduce((t, r) => t + (r.amount || 0), 0);
        const allUnsent = allRows.filter(r => r.sent !== 'Yes');
        const allUnsentTotal = allUnsent.reduce((t, r) => t + (r.amount || 0), 0);
        const isFiltered = activeFilters > 0;
        return (
          <div className="pending-send-card">
            <div className="pending-send-left">
              <div className="pending-send-label">Pending to Send</div>
              <div className="pending-send-note">
                {isFiltered
                  ? `${pendingRows.length} item${pendingRows.length !== 1 ? 's' : ''} not yet sent · filtered view`
                  : `${pendingRows.length} item${pendingRows.length !== 1 ? 's' : ''} not yet sent · all rows`}
              </div>
            </div>
            <div className="pending-send-right">
              <div className="pending-send-amount">{$fmt(pendingTotal, currency)}</div>
              {isFiltered && allUnsentTotal !== pendingTotal && (
                <div className="pending-send-allnote">
                  {$fmt(allUnsentTotal, currency)} total unfiltered
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div className="exp-table-card">
        <div className="exp-toolbar">
          <input type="text" placeholder="Search items…" value={expSearch} onChange={e => setExpSearch(e.target.value)} />
          <select value={expSem} onChange={e => setExpSem(e.target.value)}>
            <option value="all">All semesters</option>
            {sems.map(sem => <option key={sem} value={sem}>{sem}</option>)}
          </select>
          {activeFilters > 0 && (
            <button className="exp-clear-btn" onClick={clearFilters}>Clear filters</button>
          )}
        </div>
        <table className="exp">
          <thead>
            <tr>
              <SortTh label="Item"     field="item"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Category" field="cat"    sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Date"     field="date"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Amount"   field="amount" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="right" />
              <SortTh label="Status"   field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Sent"     field="sent"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr className="exp-none"><td colSpan={6}>No matching expenses.</td></tr>
              : rows.map((r, i) => (
                <tr key={i}>
                  <td><span className="exp-item">{r.item}</span></td>
                  <td><span className="exp-cat">{r.cat}</span></td>
                  <td className="exp-date">{r.date}</td>
                  <td className="right exp-amount">{$fmt(r.amount, currency)}</td>
                  <td><span className={`exp-status ${r.status}`}>{r.status}</span></td>
                  <td><span className={`exp-sent ${r.sent === 'Yes' ? 'is-yes' : 'is-no'}`}>{r.sent || '—'}</span></td>
                </tr>
              ))
            }
          </tbody>
        </table>
        {rows.length > 0 && (
          <div className="exp-count">{rows.length} row{rows.length !== 1 ? 's' : ''}</div>
        )}
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
  const actions = D.actions || [];
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

const SHEETS_LABEL = {
  loading: { text: 'Sheets · syncing…', cls: 'sheets-loading' },
  live:    { text: 'Sheets · live',     cls: 'sheets-live'    },
  static:  { text: 'Sheets · offline',  cls: 'sheets-static'  },
};

function NavFooter({ sheetsStatus }) {
  const pill = SHEETS_LABEL[sheetsStatus] || SHEETS_LABEL.static;
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-mark">
          <span className="ngs-mark on-navy"><span>N</span><span>G</span><span>S</span></span>
          <div className="footer-tag">One generation lifts another.</div>
        </div>
        <div className="footer-fine">
          <span>Pathway Navigator · Mentor View · Phase 1</span>
          <span className={`sheets-pill ${pill.cls}`}>{pill.text}</span>
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
  const [alerts, setAlerts] = useState(() => (D.alerts || []).map(a => ({ ...a })));
  const [logs, setLogs] = useState([]);
  const [liveGpa, setLiveGpa] = useState({});
  const [sheetsStatus, setSheetsStatus] = useState('loading');

  const [fxMode, setFxMode] = useState(() => storedMode());
  const [fxRate, setFxRate] = useState(() => storedRate());
  const [fxStatus, setFxStatus] = useState('idle'); // 'idle' | 'loading' | 'error'

  // Fetch market rate when mode is 'market'
  useEffect(() => {
    if (fxMode !== 'market') return;
    setFxStatus('loading');
    fetchMarketRate()
      .then(rate => {
        setFxRate(rate);
        setFxStatus('idle');
        persistFx('market', rate);
      })
      .catch(() => setFxStatus('error'));
  }, [fxMode]);

  function handleFxModeChange(mode) {
    setFxMode(mode);
    if (mode === 'manual') {
      setFxStatus('idle');
      persistFx('manual', fxRate);
    }
  }

  function handleFxRateChange(rate) {
    setFxRate(rate);
    persistFx('manual', rate);
  }

  useEffect(() => {
    loadFromSheets()
      .then(data => {
        const hasScholars = data.scholars && Object.keys(data.scholars).length > 0;
        if (!hasScholars) {
          console.warn('Sheets returned no scholar data — using static fallback');
          setSheetsStatus('static');
          return;
        }
        D = { ...data, config: { ...data.config, password: NGS_DATA.config.password } };
        setAlerts((D.alerts || []).map(a => ({ ...a })));
        setSheetsStatus('live');
      })
      .catch(err => {
        console.warn('Sheets unavailable, using static data:', err.message);
        setSheetsStatus('static');
      });
  }, []);

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
    <FxCtx.Provider value={fxRate}>
      <LockScreen isHiding={unlocked} onUnlock={() => setUnlocked(true)} />
      <NavBar
        currency={currency}
        onCurrencyChange={setCurrency}
        fxMode={fxMode}
        fxRate={fxRate}
        fxStatus={fxStatus}
        onFxModeChange={handleFxModeChange}
        onFxRateChange={handleFxRateChange}
      />
      <main className="wrap">
        <AlertsSection alerts={alerts} onDismiss={handleDismiss} />
        <StatusSection currency={currency} liveGpa={liveGpa} />
        <LogSection logs={logs} onLog={handleLog} />
        <ExpenseSection currency={currency} />
        <DeadlinesSection />
        <ActionsSection />
        <EnglishSection />
      </main>
      <NavFooter sheetsStatus={sheetsStatus} />
    </FxCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Navigator />);
