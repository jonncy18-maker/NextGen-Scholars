import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { WEB_APP_URL, writeToSheets } from './sheets-writer.js';
import { EXPENSE_CATS } from './constants.js';
import { fetchConfigMap, loadFromSheets } from './sheets-loader.js';
import './styles/entry.css';

async function loadConfig() {
  try {
    return await fetchConfigMap();
  } catch {
    return {};
  }
}

const SCHOLARS = [
  {
    key: 'claire',
    display: 'Claire',
    sems: ['Y2S1', 'Y2S2', 'Y3S1', 'Y3S2'],
    defaultSem: 'Y2S2',
  },
  {
    key: 'april',
    display: 'April',
    sems: ['TG11S1', 'TG11S2', 'TG12S1', 'TG12S2'],
    defaultSem: 'TG11S1',
  },
];

function EntryApp() {
  const [scholarKey, setScholarKey] = useState('claire');
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState(false);
  const [config, setConfig] = useState(null);

  useEffect(() => { loadConfig().then(setConfig); }, []);

  function unlock(e) {
    e.preventDefault();
    if (!config) return;
    const expected = config[`${scholarKey}_password`];
    if (expected && password === expected) {
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
    }
  }

  function logout() {
    setAuthed(false);
    setPassword('');
    setError(false);
  }

  const scholar = SCHOLARS.find(s => s.key === scholarKey);

  return authed
    ? <ExpenseForm scholar={scholar} password={password} onLogout={logout} />
    : (
      <LockGate
        scholarKey={scholarKey}
        setScholarKey={k => { setScholarKey(k); setError(false); setPassword(''); }}
        password={password}
        setPassword={v => { setPassword(v); setError(false); }}
        onSubmit={unlock}
        error={error}
        ready={!!config}
      />
    );
}

function LockGate({ scholarKey, setScholarKey, password, setPassword, onSubmit, error, ready }) {
  const inputRef = useRef();
  useEffect(() => { if (ready) inputRef.current?.focus(); }, [ready]);

  return (
    <div className="el-lock">
      <div className="el-lock-bg" />
      <div className="el-lock-inner">
        <div className="el-badge"><span>N</span><span>G</span><span>S</span></div>
        <h1 className="el-title">Add <em>Expense</em></h1>
        <p className="el-sub">Enter your password to continue</p>

        <form className={`el-form${error ? ' is-error' : ''}`} onSubmit={onSubmit} autoComplete="off">
          <div className="el-field">
            <label className="el-label">Who are you?</label>
            <div className="el-radio-row">
              {SCHOLARS.map(s => (
                <button
                  key={s.key}
                  type="button"
                  className={`el-radio${scholarKey === s.key ? ' is-active' : ''}`}
                  onClick={() => setScholarKey(s.key)}
                >
                  {s.display}
                </button>
              ))}
            </div>
          </div>

          <div className="el-field">
            <label className="el-label" htmlFor="el-pw">Password</label>
            <input
              id="el-pw"
              ref={inputRef}
              className="el-input"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={!ready}
              autoComplete="current-password"
            />
          </div>

          <div className={`el-err${error ? ' show' : ''}`}>Incorrect password — try again.</div>

          <button type="submit" disabled={!ready || !password} className="el-btn">
            {ready ? 'Continue →' : 'Loading…'}
          </button>
        </form>

        <a href="index.html" className="el-back">← Back to NextGen Scholars</a>
      </div>
    </div>
  );
}

function ExpenseForm({ scholar, password, onLogout }) {
  const todayISO = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    sem:    scholar.defaultSem,
    item:   '',
    cat:    EXPENSE_CATS[0],
    amount: '',
    qty:    '1',
    date:   todayISO,
    avb:    'Actual',
    vendor: '',
  });
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saved'
  const [expensesBySem, setExpensesBySem] = useState(null);

  useEffect(() => {
    loadFromSheets()
      .then(data => setExpensesBySem(data.scholars?.[scholar.key]?.expenses || {}))
      .catch(() => setExpensesBySem({}));
  }, [scholar.key]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid =
    form.item.trim() &&
    form.sem.trim() &&
    form.amount &&
    !isNaN(parseFloat(form.amount)) &&
    parseFloat(form.amount) > 0;

  function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    // Password travels with the payload so Apps Script can validate before writing
    writeToSheets({
      action:  'addExpense',
      scholar: scholar.key,
      password,
      sem:     form.sem.trim(),
      item:    form.item.trim(),
      cat:     form.cat,
      amount:  form.amount,
      qty:     form.qty,
      date:    form.date,
      avb:     form.avb,
      sent:    'No',
      vendor:  form.vendor.trim(),
    });
    setSaveState('saved');
    setTimeout(() => {
      setSaveState('idle');
      setForm(f => ({ ...f, item: '', amount: '', qty: '1', vendor: '' }));
    }, 1800);
  }

  const semExpenses = expensesBySem?.[form.sem] || [];
  const actualTotal = semExpenses.filter(e => e.avb === 'Actual').reduce((t, e) => t + (e.amount || 0) * (e.qty || 1), 0);
  const budgetTotal = semExpenses.filter(e => e.avb !== 'Actual').reduce((t, e) => t + (e.amount || 0) * (e.qty || 1), 0);

  return (
    <div className="ef-page">
      <header className="ef-header">
        <div className="ef-header-left">
          <div className="el-badge el-badge-sm"><span>N</span><span>G</span><span>S</span></div>
          <span className="ef-header-title">Add Expense — <strong>{scholar.display}</strong></span>
        </div>
        <div className="ef-header-right">
          <a href="index.html" className="ef-home-link">← Home</a>
          <button className="ef-logout" onClick={onLogout}>Switch scholar</button>
        </div>
      </header>

      <main className="ef-main">
        {expensesBySem !== null && (
          <div className="ef-summary">
            <div className="ef-summary-stat">
              <span className="ef-summary-label">Actual spend</span>
              <strong className="ef-summary-val">₱{Math.round(actualTotal).toLocaleString('en-US')}</strong>
            </div>
            {budgetTotal > 0 && (
              <div className="ef-summary-stat">
                <span className="ef-summary-label">Pending</span>
                <strong className="ef-summary-val">₱{Math.round(budgetTotal).toLocaleString('en-US')}</strong>
              </div>
            )}
            <div className="ef-summary-stat">
              <span className="ef-summary-label">Items</span>
              <strong className="ef-summary-val">{semExpenses.length}</strong>
            </div>
            <span className="ef-summary-sem">{form.sem}</span>
          </div>
        )}

        {saveState === 'saved' && <div className="ef-toast">✓ Expense saved</div>}

        <form className="ef-grid" onSubmit={handleSubmit}>
          <div className="ef-field ef-field-wide">
            <label>Item</label>
            <input
              type="text"
              placeholder="e.g. Tuition — Prelim"
              value={form.item}
              onChange={e => set('item', e.target.value)}
              autoFocus
            />
          </div>

          <div className="ef-field">
            <label>Category</label>
            <select value={form.cat} onChange={e => set('cat', e.target.value)}>
              {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="ef-field">
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

          <div className="ef-field">
            <label>Qty</label>
            <input
              type="number"
              min="1"
              value={form.qty}
              onChange={e => set('qty', e.target.value)}
            />
          </div>

          <div className="ef-field">
            <label>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
            />
          </div>

          <div className="ef-field">
            <label>Semester</label>
            <input
              list="ef-sems"
              value={form.sem}
              placeholder="e.g. Y3S1"
              onChange={e => set('sem', e.target.value)}
            />
            <datalist id="ef-sems">
              {scholar.sems.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div className="ef-field">
            <label>Status</label>
            <select value={form.avb} onChange={e => set('avb', e.target.value)}>
              <option value="Actual">Actual</option>
              <option value="Budget">Budget</option>
            </select>
          </div>

          <div className="ef-field ef-field-wide">
            <label>Vendor <span className="ef-optional">(optional)</span></label>
            <input
              type="text"
              placeholder="Optional"
              value={form.vendor}
              onChange={e => set('vendor', e.target.value)}
            />
          </div>

          <div className="ef-submit-row">
            <button
              type="submit"
              disabled={!valid}
              className={`ef-save${saveState === 'saved' ? ' is-saved' : ''}`}
            >
              {saveState === 'saved' ? '✓ Saved' : 'Save expense'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<EntryApp />);
