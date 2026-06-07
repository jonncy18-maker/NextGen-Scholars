import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { EXPENSE_CATS } from './constants.js';
import { writeExpense } from './supabase-writer.js';
import { loadFromSupabase } from './supabase-loader.js';
import { supabase } from './lib/supabase.js';
import { groupExpenses } from './components/expenses/filterHelpers.js';
import './styles/entry.css';

async function loadConfig() {
  try {
    const { data } = await supabase.from('config').select('key, value');
    const map = {};
    (data || []).forEach(r => { map[r.key] = r.value; });
    return map;
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
  const [groupBy, setGroupBy] = useState('none');
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  useEffect(() => {
    loadFromSupabase()
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
    writeExpense(scholar.key, {
      id:     `${scholar.key}_${form.sem.trim()}_${Date.now()}`,
      sem:    form.sem.trim(),
      item:   form.item.trim(),
      cat:    form.cat,
      amount: parseFloat(form.amount),
      qty:    parseInt(form.qty, 10) || 1,
      date:   form.date,
      avb:    form.avb,
      sent:   'No',
      vendor: form.vendor.trim(),
    }).catch(err => console.error('writeExpense failed:', err));
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

        {semExpenses.length > 0 && (() => {
          const groups = groupExpenses(semExpenses, groupBy);
          function toggleGroup(key) {
            setExpandedGroups(prev => {
              const next = new Set(prev);
              next.has(key) ? next.delete(key) : next.add(key);
              return next;
            });
          }
          function renderEntryRow(e, i) {
            const total = (e.amount || 0) * (e.qty || 1);
            return (
              <tr key={i} className={e.avb !== 'Actual' ? 'ef-entries-budget' : ''}>
                <td className="ef-entries-item">{e.item}</td>
                <td><span className="ef-entries-cat">{e.cat}</span></td>
                <td className="ef-entries-date">{e.date}</td>
                <td className="ef-entries-right ef-entries-amount">₱{Math.round(total).toLocaleString('en-US')}</td>
                <td><span className={`ef-entries-status is-${(e.avb || '').toLowerCase()}`}>{e.avb}</span></td>
              </tr>
            );
          }
          const allExpanded = groups && groups.length > 0 && groups.every(g => expandedGroups.has(g.key));
          return (
            <div className="ef-entries">
              <div className="ef-entries-header">
                <span className="ef-entries-title">{form.sem} · {semExpenses.length} item{semExpenses.length !== 1 ? 's' : ''}</span>
                <div className="ef-groupby">
                  <span className="ef-groupby-label">Group</span>
                  <div className="ef-groupby-chips">
                    {[['none','None'],['month','Month'],['category','Category']].map(([val, lbl]) => (
                      <button key={val}
                        className={groupBy === val ? 'active' : ''}
                        onClick={() => { setGroupBy(val); setExpandedGroups(new Set()); }}
                      >{lbl}</button>
                    ))}
                  </div>
                  {groups && groups.length > 0 && (
                    <button className="ef-groupby-all-btn" onClick={() =>
                      setExpandedGroups(allExpanded ? new Set() : new Set(groups.map(g => g.key)))
                    }>
                      {allExpanded ? 'Collapse All' : 'Expand All'}
                    </button>
                  )}
                </div>
              </div>
              <div className="ef-entries-scroll">
                <table className="ef-entries-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Date</th>
                      <th className="ef-entries-right">Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  {groups
                    ? groups.map(group => {
                        const collapsed = !expandedGroups.has(group.key);
                        return (
                          <React.Fragment key={group.key}>
                            <tbody>
                              <tr className="ef-group-hd" onClick={() => toggleGroup(group.key)}>
                                <td colSpan={5}>
                                  <span>{collapsed ? '▶' : '▼'}</span>
                                  <span className="ef-group-label">{group.label}</span>
                                  <span className="ef-group-meta">{group.rows.length} item{group.rows.length !== 1 ? 's' : ''}</span>
                                  <span className="ef-group-total">₱{Math.round(group.total).toLocaleString('en-US')}</span>
                                </td>
                              </tr>
                            </tbody>
                            {!collapsed && (
                              <tbody>
                                {group.rows.map(renderEntryRow)}
                                <tr className="ef-subtotal">
                                  <td colSpan={3} className="ef-subtotal-label">Subtotal — {group.label}</td>
                                  <td className="ef-subtotal-amt ef-entries-right">₱{Math.round(group.total).toLocaleString('en-US')}</td>
                                  <td />
                                </tr>
                              </tbody>
                            )}
                          </React.Fragment>
                        );
                      })
                    : <tbody>{semExpenses.map(renderEntryRow)}</tbody>
                  }
                </table>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<EntryApp />);
