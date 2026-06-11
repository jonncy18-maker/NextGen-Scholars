import React, { useState } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { EXPENSE_CATS, SEMESTER_OPTIONS } from '../../constants.js';

function makeEmptyRow(defaultSem) {
  return {
    _id:    Math.random().toString(36).slice(2),
    sem:    defaultSem || '',
    item:   '',
    cat:    EXPENSE_CATS[0],
    amount: '',
    qty:    '1',
    date:   new Date().toISOString().split('T')[0],
    avb:    'Actual',
    sent:   'No',
    vendor: '',
  };
}

function rowValid(r) {
  return r.item.trim() && r.amount && !isNaN(parseFloat(r.amount)) && parseFloat(r.amount) > 0 && r.sem.trim();
}

function makeDeposit(date) {
  return { _id: Math.random().toString(36).slice(2), amount: '', date, sent: 'No' };
}

export function AddExpenseForm({ scholar, onAdd, onCancel }) {
  const { D } = useData();
  const s = D.scholars[scholar];
  const existingSems = Object.keys(s.expenses || {});
  const defaultSem = existingSems[existingSems.length - 1] || (s.currentSem || '');
  const todayISO = new Date().toISOString().split('T')[0];

  const [mode, setMode] = useState(null); // null | 'single' | 'multiple'

  // ── Single mode state ──────────────────────────────────────────────────────
  const [form, setForm] = useState({
    sem:    defaultSem,
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
  const [toast, setToast] = useState(false);

  // ── Split deposits state (single mode) ────────────────────────────────────
  const [splitMode, setSplitMode] = useState(false);
  const [splitDeposits, setSplitDeposits] = useState([makeDeposit(todayISO), makeDeposit(todayISO)]);

  function setDepField(id, k, v) {
    setSplitDeposits(ds => ds.map(d => d._id === id ? { ...d, [k]: v } : d));
  }
  function addSplitRow() {
    setSplitDeposits(ds => [...ds, makeDeposit(todayISO)]);
  }
  function removeSplitRow(id) {
    setSplitDeposits(ds => ds.length > 2 ? ds.filter(d => d._id !== id) : ds);
  }
  const validSplitDeps = splitDeposits.filter(d => d.amount && parseFloat(d.amount) > 0);
  const splitTotal     = validSplitDeps.reduce((s, d) => s + parseFloat(d.amount), 0);
  const splitValid     = form.item.trim() && form.sem.trim() && validSplitDeps.length >= 2;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const singleValid = form.item.trim() && form.amount && !isNaN(parseFloat(form.amount)) && parseFloat(form.amount) > 0 && form.sem.trim();

  function resetSingleForm() {
    setForm(f => ({ ...f, item: '', amount: '', qty: '1', vendor: '' }));
    setSplitMode(false);
    setSplitDeposits([makeDeposit(todayISO), makeDeposit(todayISO)]);
  }

  function handleSingleSubmit(e) {
    e.preventDefault();

    if (splitMode) {
      if (!splitValid) return;
      const groupId = `grp_${Date.now()}`;
      validSplitDeps.forEach((d, i) => {
        onAdd(scholar, {
          id:       `local_${Date.now()}_${i}`,
          item:     form.item.trim(),
          cat:      form.cat,
          amount:   parseFloat(d.amount),
          qty:      1,
          date:     d.date,
          avb:      form.avb,
          sent:     d.sent,
          vendor:   form.vendor.trim(),
          sem:      form.sem.trim(),
          group_id: groupId,
        });
      });
      setSaved(true);
      setToast(true);
      setTimeout(() => setToast(false), 2200);
      setTimeout(() => { setSaved(false); resetSingleForm(); }, 1200);
      return;
    }

    if (!singleValid) return;
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
    };
    onAdd(scholar, exp);
    setSaved(true);
    setToast(true);
    setTimeout(() => setToast(false), 2200);
    setTimeout(() => { setSaved(false); setForm(f => ({ ...f, item: '', amount: '', qty: '1', vendor: '' })); }, 1200);
  }

  // ── Multiple mode state ────────────────────────────────────────────────────
  const [multiRows, setMultiRows] = useState(() => [makeEmptyRow(defaultSem), makeEmptyRow(defaultSem)]);
  const [multiSaved, setMultiSaved] = useState(false);

  function setRow(id, k, v) {
    setMultiRows(rows => rows.map(r => r._id === id ? { ...r, [k]: v } : r));
  }
  function addRow() {
    setMultiRows(rows => [...rows, makeEmptyRow(rows[rows.length - 1]?.sem || defaultSem)]);
  }
  function removeRow(id) {
    setMultiRows(rows => rows.length > 1 ? rows.filter(r => r._id !== id) : rows);
  }

  const filledRows = multiRows.filter(r => r.item.trim() || r.amount);
  const validRows  = filledRows.filter(rowValid);
  const multiValid = validRows.length > 0;

  function handleMultiSubmit() {
    if (!multiValid) return;
    validRows.forEach(r => {
      const exp = {
        id:     `local_${Date.now()}_${r._id}`,
        item:   r.item.trim(),
        cat:    r.cat,
        amount: parseFloat(r.amount),
        qty:    parseInt(r.qty) || 1,
        date:   r.date,
        avb:    r.avb,
        sent:   r.sent,
        vendor: r.vendor.trim(),
        sem:    r.sem.trim(),
      };
      onAdd(scholar, exp);
    });
    setMultiSaved(true);
    setTimeout(() => {
      setMultiSaved(false);
      setMultiRows([makeEmptyRow(defaultSem), makeEmptyRow(defaultSem)]);
      setMode(null);
    }, 1400);
  }

  // ── Mode chooser ───────────────────────────────────────────────────────────
  if (mode === null) {
    return (
      <div className="add-exp-card">
        <div className="add-exp-title">Add Expense — {s.firstName}</div>
        <div className="add-exp-mode-chooser">
          <button className="add-exp-mode-btn" onClick={() => setMode('single')}>
            <span className="add-exp-mode-icon">＋</span>
            <span className="add-exp-mode-label">Single</span>
            <span className="add-exp-mode-sub">One expense at a time</span>
          </button>
          <button className="add-exp-mode-btn" onClick={() => setMode('multiple')}>
            <span className="add-exp-mode-icon">⊞</span>
            <span className="add-exp-mode-label">Multiple</span>
            <span className="add-exp-mode-sub">Enter several at once</span>
          </button>
        </div>
        <div className="add-exp-actions" style={{ borderTop: 0, paddingTop: 0 }}>
          <button type="button" className="add-exp-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  // ── Single mode ────────────────────────────────────────────────────────────
  if (mode === 'single') {
    const submitDisabled = splitMode ? !splitValid : !singleValid;
    const submitLabel = saved
      ? '✓ Saved'
      : splitMode
        ? `Save ${validSplitDeps.length} deposit${validSplitDeps.length !== 1 ? 's' : ''}`
        : 'Save expense';

    return (
      <>
      {toast && <div className="add-exp-toast">✓ Expense saved</div>}
      <div className="add-exp-card">
        <div className="add-exp-title">Add Expense — {s.firstName}</div>
        <form className="add-exp-form" onSubmit={handleSingleSubmit}>
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

          {/* Amount — hidden in split mode (total comes from deposits) */}
          {!splitMode && (
            <div className="field">
              <label>Amount (₱)</label>
              <input
                type="number" step="0.01" min="0" placeholder="0.00"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
              />
            </div>
          )}
          {splitMode && (
            <div className="field">
              <label>Amount (₱)</label>
              <div className="split-amount-display">
                <span className="split-amount-total">
                  {splitTotal > 0 ? `₱ ${splitTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Enter deposits below'}
                </span>
                <span className="split-amount-note">sum of deposits</span>
              </div>
            </div>
          )}

          {/* Split toggle */}
          <div className="field split-toggle-row">
            <button
              type="button"
              className={`split-toggle-btn${splitMode ? ' is-on' : ''}`}
              onClick={() => setSplitMode(v => !v)}
            >
              {splitMode ? '▼ Split deposits (on)' : '▶ Split into deposits'}
            </button>
          </div>

          {/* Deposit rows */}
          {splitMode && (
            <div className="field split-deposits-section" style={{ gridColumn: '1 / -1' }}>
              <div className="split-deposits-header">
                <span>Amount (₱)</span>
                <span>Date</span>
                <span>Sent</span>
                <span></span>
              </div>
              {splitDeposits.map((d) => (
                <div key={d._id} className="split-deposit-row">
                  <input
                    type="number" step="0.01" min="0" placeholder="0.00"
                    value={d.amount}
                    onChange={e => setDepField(d._id, 'amount', e.target.value)}
                  />
                  <input
                    type="date"
                    value={d.date}
                    onChange={e => setDepField(d._id, 'date', e.target.value)}
                  />
                  <select value={d.sent} onChange={e => setDepField(d._id, 'sent', e.target.value)}>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                  <button
                    type="button"
                    className="split-deposit-remove"
                    onClick={() => removeSplitRow(d._id)}
                    disabled={splitDeposits.length <= 2}
                    title="Remove deposit"
                  >×</button>
                </div>
              ))}
              <button type="button" className="split-deposit-add-btn" onClick={addSplitRow}>
                + Add deposit
              </button>
              {splitTotal > 0 && (
                <div className="split-total-row">
                  Total: <strong>₱ {splitTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
              )}
            </div>
          )}

          {/* Non-split fields */}
          {!splitMode && (
            <div className="field">
              <label>Qty</label>
              <input type="number" min="1" value={form.qty} onChange={e => set('qty', e.target.value)} />
            </div>
          )}
          {!splitMode && (
            <div className="field">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
          )}
          <div className="field">
            <label>Semester</label>
            <select value={form.sem} onChange={e => set('sem', e.target.value)}>
              <option value="">— select —</option>
              {SEMESTER_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={form.avb} onChange={e => set('avb', e.target.value)}>
              <option value="Actual">Actual</option>
              <option value="Budget">Budget</option>
            </select>
          </div>
          {!splitMode && (
            <div className="field">
              <label>Sent</label>
              <select value={form.sent} onChange={e => set('sent', e.target.value)}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          )}
          <div className="field">
            <label>Vendor</label>
            <input type="text" placeholder="Optional" value={form.vendor} onChange={e => set('vendor', e.target.value)} />
          </div>
          <div className="add-exp-actions">
            <button type="button" className="add-exp-cancel" onClick={() => setMode(null)}>← Back</button>
            <button type="button" className="add-exp-cancel" onClick={onCancel}>Cancel</button>
            <button type="submit" className={`add-exp-save${saved ? ' is-saved' : ''}`} disabled={submitDisabled}>
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
      </>
    );
  }

  // ── Multiple mode ──────────────────────────────────────────────────────────
  return (
    <div className="add-exp-card add-exp-card-multi">
      <div className="add-exp-title">Add Multiple Expenses — {s.firstName}</div>
      <div className="add-exp-multi-scroll">
        <table className="add-exp-multi-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Amount (₱)</th>
              <th>Qty</th>
              <th>Date</th>
              <th>Semester</th>
              <th>Status</th>
              <th>Sent</th>
              <th>Vendor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {multiRows.map((r, idx) => (
              <tr key={r._id} className={rowValid(r) ? 'add-exp-row-valid' : ''}>
                <td>
                  <input
                    className="add-exp-multi-input"
                    type="text"
                    placeholder="Item name"
                    value={r.item}
                    onChange={e => setRow(r._id, 'item', e.target.value)}
                    autoFocus={idx === 0}
                  />
                </td>
                <td>
                  <select className="add-exp-multi-input" value={r.cat} onChange={e => setRow(r._id, 'cat', e.target.value)}>
                    {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    className="add-exp-multi-input add-exp-multi-num"
                    type="number" step="0.01" min="0" placeholder="0.00"
                    value={r.amount}
                    onChange={e => setRow(r._id, 'amount', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="add-exp-multi-input add-exp-multi-sm"
                    type="number" min="1"
                    value={r.qty}
                    onChange={e => setRow(r._id, 'qty', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="add-exp-multi-input"
                    type="date"
                    value={r.date}
                    onChange={e => setRow(r._id, 'date', e.target.value)}
                  />
                </td>
                <td>
                  <select className="add-exp-multi-input add-exp-multi-sm" value={r.sem} onChange={e => setRow(r._id, 'sem', e.target.value)}>
                    <option value="">—</option>
                    {SEMESTER_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <select className="add-exp-multi-input add-exp-multi-sm" value={r.avb} onChange={e => setRow(r._id, 'avb', e.target.value)}>
                    <option value="Actual">Actual</option>
                    <option value="Budget">Budget</option>
                  </select>
                </td>
                <td>
                  <select className="add-exp-multi-input add-exp-multi-sm" value={r.sent} onChange={e => setRow(r._id, 'sent', e.target.value)}>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </td>
                <td>
                  <input
                    className="add-exp-multi-input"
                    type="text" placeholder="Optional"
                    value={r.vendor}
                    onChange={e => setRow(r._id, 'vendor', e.target.value)}
                  />
                </td>
                <td>
                  <button
                    className="add-exp-multi-del"
                    type="button"
                    onClick={() => removeRow(r._id)}
                    title="Remove row"
                    disabled={multiRows.length === 1}
                  >×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="add-exp-multi-footer">
        <button type="button" className="add-exp-multi-add-row" onClick={addRow}>
          + Add another expense
        </button>
        <div className="add-exp-actions" style={{ borderTop: 0, paddingTop: 0, flex: 1, justifyContent: 'flex-end' }}>
          <button type="button" className="add-exp-cancel" onClick={() => setMode(null)}>← Back</button>
          <button type="button" className="add-exp-cancel" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className={`add-exp-save${multiSaved ? ' is-saved' : ''}`}
            disabled={!multiValid || multiSaved}
            onClick={handleMultiSubmit}
          >
            {multiSaved ? `✓ Saved ${validRows.length}` : `Save ${validRows.length > 0 ? validRows.length : ''} expense${validRows.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
