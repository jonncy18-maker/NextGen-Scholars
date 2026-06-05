import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/navigator.css';
import { NGS_DATA } from '../scholars-data.js';
import { loadFromSheets } from './sheets-loader.js';
import { storedMode, storedRate, persistFx, fetchMarketRate, DEFAULT_RATE } from './fx.js';
import { writeSent, writeExpense, writeActionToggle } from './sheets-writer.js';
import { allExpenses, scholarTotals, nextMilestone, accentFor } from './utils.js';

if (!NGS_DATA || !NGS_DATA.config) {
  throw new Error('NGS_DATA missing — hard-refresh (Ctrl/Cmd+Shift+R)');
}

let D = NGS_DATA;
const SCHOLAR_KEYS = ['claire', 'april', 'aljane'].filter(k => D.scholars[k]);

// Scholar name → CSS modifier class. Keys are lowercase to match data keys.
const NAMECLASS = { claire: '', april: 't-april', aljane: 't-aljane' };

const EXPENSE_CATS = [
  'Tuition', 'Enrollment', 'Uniforms', 'Books', 'Living Expenses',
  'Printing & Research', 'School Supplies', 'Activities',
  'Medical Equipment', 'Motor', 'Milestones', 'Other',
];

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

function NavBar({ currency, onCurrencyChange, fxMode, fxRate, fxStatus, onFxModeChange, onFxRateChange, sheetsStatus, onRefresh }) {
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

          <button
            className={`nav-refresh${sheetsStatus === 'loading' ? ' is-loading' : ''}`}
            onClick={onRefresh}
            title="Reload data from Google Sheets"
          >
            <span className="refresh-icon">↻</span> Refresh
          </button>

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

function ChartSem({ s, currency, extraRows }) {
  const $fmt = useFmt();
  const sems = Object.keys(s.expenses || {});
  // include semesters from locally-added rows
  const extraSems = [...new Set((extraRows || []).map(r => r.sem))].filter(sem => !sems.includes(sem));
  const allSems = [...sems, ...extraSems];

  const data = allSems.map(sem => {
    let actual = 0, budget = 0;
    (s.expenses[sem] || []).forEach(e => { const tot = (e.amount || 0) * (e.qty || 1); if (e.avb === 'Actual') actual += tot; else budget += tot; });
    (extraRows || []).filter(r => r.sem === sem).forEach(e => { const tot = (e.amount || 0) * (e.qty || 1); if (e.avb === 'Actual') actual += tot; else budget += tot; });
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

function ChartCat({ s, currency, extraRows }) {
  const $fmt = useFmt();
  const totals = {};
  [...allExpenses(s), ...(extraRows || [])].forEach(e => { totals[e.cat] = (totals[e.cat] || 0) + (e.amount || 0) * (e.qty || 1); });
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
    if (field === 'qty')    { va = a.qty    || 1;  vb = b.qty    || 1;  }
    if (field === 'total')  { va = (a.amount || 0) * (a.qty || 1); vb = (b.amount || 0) * (b.qty || 1); }
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

// ── add expense form ──────────────────────────────────────────────────────────

function AddExpenseForm({ scholar, onAdd, onCancel }) {
  const s = D.scholars[scholar];
  const existingSems = Object.keys(s.expenses || {});
  const todayISO = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    sem:    existingSems[existingSems.length - 1] || (s.currentSem || ''),
    item:   '',
    cat:    EXPENSE_CATS[0],
    amount: '',
    qty:    '1',
    date:   todayISO,
    avb:    'Actual',
    sent:   'No',
    vendor: '',
  });
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.item.trim() && form.amount && !isNaN(parseFloat(form.amount)) && parseFloat(form.amount) > 0 && form.sem.trim();

  function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    const exp = {
      id:     `local_${Date.now()}`,
      item:   form.item.trim(),
      cat:    form.cat,
      amount: parseFloat(form.amount),
      qty:    parseInt(form.qty) || 1,
      date:   form.date,
      avb:    form.avb,
      sent:   form.sent,
      vendor: form.vendor.trim(),
      sem:    form.sem.trim(),
      status: form.avb,
    };
    onAdd(scholar, exp);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setForm(f => ({ ...f, item: '', amount: '', qty: '1', vendor: '' }));
    }, 1200);
  }

  return (
    <div className="add-exp-card">
      <div className="add-exp-title">Add Expense — {s.firstName}</div>
      <form className="add-exp-form" onSubmit={handleSubmit}>
        <div className="field">
          <label>Item</label>
          <input
            type="text"
            placeholder="e.g. Tuition - Prelim"
            value={form.item}
            onChange={e => set('item', e.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label>Category</label>
          <select value={form.cat} onChange={e => set('cat', e.target.value)}>
            {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Amount (₱)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={form.amount}
            onChange={e => set('amount', e.target.value)}
          />
        </div>
        <div className="field">
          <label>Qty</label>
          <input type="number" min="1" value={form.qty} onChange={e => set('qty', e.target.value)} />
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
        <div className="field">
          <label>Semester</label>
          <input
            list="add-exp-sems"
            value={form.sem}
            placeholder="e.g. Y3S1"
            onChange={e => set('sem', e.target.value)}
          />
          <datalist id="add-exp-sems">
            {existingSems.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={form.avb} onChange={e => set('avb', e.target.value)}>
            <option value="Actual">Actual</option>
            <option value="Budget">Budget</option>
          </select>
        </div>
        <div className="field">
          <label>Sent</label>
          <select value={form.sent} onChange={e => set('sent', e.target.value)}>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
        <div className="field">
          <label>Vendor</label>
          <input type="text" placeholder="Optional" value={form.vendor} onChange={e => set('vendor', e.target.value)} />
        </div>
        <div className="add-exp-actions">
          <button type="button" className="add-exp-cancel" onClick={onCancel}>Cancel</button>
          <button type="submit" className={`add-exp-save${saved ? ' is-saved' : ''}`} disabled={!valid}>
            {saved ? '✓ Saved' : 'Save expense'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── expense section ───────────────────────────────────────────────────────────

function ExpenseSection({ currency, addedExpenses, onAddExpense }) {
  const $fmt = useFmt();

  const [expScholar, setExpScholar] = useState(SCHOLAR_KEYS[0]);
  const [expView, setExpView] = useState('sem');
  const [expSearch, setExpSearch] = useState('');
  const [expSem, setExpSem] = useState('all');

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const [sentAll, setSentAll] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ngs_sent') || '{}'); } catch { return {}; }
  });
  const [deletedAll, setDeletedAll] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ngs_deleted') || '{}'); } catch { return {}; }
  });
  const sentOverrides = new Set(sentAll[expScholar] || []);
  const deletedIds = new Set(deletedAll[expScholar] || []);
  const [showAddForm, setShowAddForm] = useState(false);

  function handleMarkSent(r) {
    setSentAll(prev => {
      const updated = { ...prev, [expScholar]: [...new Set([...(prev[expScholar] || []), String(r.id)])] };
      try { localStorage.setItem('ngs_sent', JSON.stringify(updated)); } catch {}
      return updated;
    });
    writeSent(r.id, expScholar);
  }

  function handleDeleteExpense(r) {
    setDeletedAll(prev => {
      const updated = { ...prev, [expScholar]: [...new Set([...(prev[expScholar] || []), String(r.id)])] };
      try { localStorage.setItem('ngs_deleted', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }

  const s = { ...D.scholars[expScholar], _key: expScholar };
  const sems = Object.keys(s.expenses || {});

  const baseRows = allExpenses(s);
  const localRows = (addedExpenses[expScholar] || []).map(e => ({ ...e, status: e.avb }));
  const allRows = [...baseRows, ...localRows].filter(r => !deletedIds.has(String(r.id)));

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

    setShowAddForm(false);
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
      <div className="eyebrow"><span className="num">03</span> Expense Dashboard <span className="eyebrow-rule" /></div>
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
        <div className="exp-controls-right">
          <div className="viewtoggle">
            {[['sem', 'By Semester'], ['cat', 'By Category']].map(([v, lbl]) => (
              <button key={v} className={expView === v ? 'active' : ''} onClick={() => setExpView(v)}>{lbl}</button>
            ))}
          </div>
          <button
            className={`add-exp-btn${showAddForm ? ' is-open' : ''}`}
            onClick={() => setShowAddForm(v => !v)}
          >
            {showAddForm ? '✕ Cancel' : '+ Add Expense'}
          </button>
        </div>
      </div>

      {showAddForm && (
        <AddExpenseForm
          scholar={expScholar}
          onAdd={(scholar, exp) => { onAddExpense(scholar, exp); }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <TotalsRow s={s} currency={currency} />
      <div className="chart-card">
        {expView === 'sem'
          ? <ChartSem key={expScholar + '-sem'} s={s} currency={currency} extraRows={localRows} />
          : <ChartCat key={expScholar + '-cat'} s={s} currency={currency} extraRows={localRows} />
        }
      </div>

      {(() => {
        const pendingRows = rows.filter(r => r.sent !== 'Yes');
        const pendingTotal = pendingRows.reduce((t, r) => t + (r.amount || 0) * (r.qty || 1), 0);
        const allUnsent = allRows.filter(r => r.sent !== 'Yes');
        const allUnsentTotal = allUnsent.reduce((t, r) => t + (r.amount || 0) * (r.qty || 1), 0);
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
              <SortTh label="Item"       field="item"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Category"  field="cat"    sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Date"      field="date"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Unit Price" field="amount" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="right" />
              <SortTh label="Qty"       field="qty"    sortField={sortField} sortDir={sortDir} onSort={handleSort} className="right" />
              <SortTh label="Total"     field="total"  sortField={sortField} sortDir={sortDir} onSort={handleSort} className="right" />
              <SortTh label="Status"    field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Sent"      field="sent"   sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <th className="exp-th-del" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr className="exp-none"><td colSpan={9}>No matching expenses.</td></tr>
              : rows.map((r, i) => {
                const isSent = r.sent === 'Yes' || sentOverrides.has(String(r.id));
                const qty = r.qty || 1;
                const total = (r.amount || 0) * qty;
                return (
                  <tr key={i}>
                    <td><span className="exp-item">{r.item}</span></td>
                    <td><span className="exp-cat">{r.cat}</span></td>
                    <td className="exp-date">{r.date}</td>
                    <td className="right exp-amount">{$fmt(r.amount, currency)}</td>
                    <td className="right exp-qty">{qty}</td>
                    <td className="right exp-total">{$fmt(total, currency)}</td>
                    <td><span className={`exp-status ${r.status}`}>{r.status}</span></td>
                    <td>
                      {isSent
                        ? <span className="exp-sent is-yes">✓ Sent</span>
                        : <button className="exp-sent is-no mark-sent-btn" title="Mark as sent in Sheets" onClick={() => handleMarkSent(r)}>Mark Sent →</button>
                      }
                    </td>
                    <td className="exp-del-cell">
                      <button className="exp-del-btn" title="Delete expense" onClick={() => handleDeleteExpense(r)}>Delete</button>
                    </td>
                  </tr>
                );
              })
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
  const sorted = [...(D.deadlines || [])].sort((a, b) => (a.sort || '').localeCompare(b.sort || ''));
  return (
    <section className="section">
      <div className="eyebrow"><span className="num">04</span> Critical Deadlines <span className="eyebrow-rule" /></div>
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
  const actions = D.actions || [];
  const left = actions.length - Object.values(checked).filter(Boolean).length;

  function toggle(id) {
    const newDone = !checked[id];
    setChecked(c => ({ ...c, [id]: newDone }));
    writeActionToggle(id, newDone);
  }

  return (
    <section className="section">
      <div className="eyebrow"><span className="num">05</span> Mentor Action Items <span className="eyebrow-rule" /></div>
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

function EnglishCard({ sk }) {
  const s = D.scholars[sk];
  const eng = s?.english;
  if (!eng) return null;
  return (
    <div className="eng-card">
      <div className="eng-scholar">{eng.scholar}</div>
      <div className="eng-stage">{eng.stage}</div>
      <p className="eng-desc">{eng.desc}</p>
      <div className="eng-obs">
        {eng.observations.map((ob, i) => (
          <div key={i} className="eng-ob">
            <span className={`eng-dot ${ob.type}`} />
            {ob.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function EnglishSection() {
  const withEnglish = SCHOLAR_KEYS.filter(k => D.scholars[k]?.english);
  return (
    <section className="section">
      <div className="eyebrow"><span className="num">06</span> English Development Pulse <span className="eyebrow-rule" /></div>
      <div className="section-head"><h2 className="section-title">From Cebu to the world</h2></div>
      <div className="eng-grid">
        {withEnglish.map(k => <EnglishCard key={k} sk={k} />)}
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
  const [liveGpa, setLiveGpa] = useState({});
  const [sheetsStatus, setSheetsStatus] = useState('loading');
  const [refreshKey, setRefreshKey] = useState(0);

  const [fxMode, setFxMode] = useState(() => storedMode());
  const [fxRate, setFxRate] = useState(() => storedRate());
  const [fxStatus, setFxStatus] = useState('idle');

  // addedExpenses tracks locally-added rows across scholar switches: { claire: [], april: [], ... }
  // Persisted to localStorage so they survive page refreshes.
  const [addedExpenses, setAddedExpenses] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ngs_added') || '{}'); } catch { return {}; }
  });

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

  // Load from Sheets — re-runs on manual refresh
  useEffect(() => {
    setSheetsStatus('loading');
    loadFromSheets()
      .then(data => {
        const hasScholars = data.scholars && Object.keys(data.scholars).length > 0;
        if (!hasScholars) {
          console.warn('Sheets returned no scholar data — using static fallback');
          setSheetsStatus('static');
          return;
        }
        // Merge Sheets data with static fields (english, publicProfile) not held in Sheets
        const mergedScholars = {};
        Object.keys(data.scholars).forEach(k => {
          mergedScholars[k] = {
            ...data.scholars[k],
            english: NGS_DATA.scholars[k]?.english,
            publicProfile: NGS_DATA.scholars[k]?.publicProfile,
          };
        });
        D = {
          ...data,
          scholars: mergedScholars,
          config: { ...data.config, password: NGS_DATA.config.password },
        };
        setAlerts((D.alerts || []).map(a => ({ ...a })));
        setSheetsStatus('live');
      })
      .catch(err => {
        console.warn('Sheets unavailable, using static data:', err.message);
        setSheetsStatus('static');
      });
  }, [refreshKey]);

  function handleDismiss(id) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, _dismissed: true } : a));
  }

  function handleAddExpense(scholar, exp) {
    setAddedExpenses(prev => {
      const updated = { ...prev, [scholar]: [...(prev[scholar] || []), exp] };
      try { localStorage.setItem('ngs_added', JSON.stringify(updated)); } catch {}
      return updated;
    });
    writeExpense(scholar, exp);
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
        sheetsStatus={sheetsStatus}
        onRefresh={() => setRefreshKey(k => k + 1)}
      />
      <main className="wrap">
        <AlertsSection alerts={alerts} onDismiss={handleDismiss} />
        <StatusSection currency={currency} liveGpa={liveGpa} />
        <ExpenseSection
          currency={currency}
          addedExpenses={addedExpenses}
          onAddExpense={handleAddExpense}
        />
        <DeadlinesSection />
        <ActionsSection />
        <EnglishSection />
      </main>
      <NavFooter sheetsStatus={sheetsStatus} />
    </FxCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Navigator />);
