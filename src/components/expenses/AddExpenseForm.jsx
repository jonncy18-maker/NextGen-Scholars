import React, { useState } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { EXPENSE_CATS } from '../../constants.js';

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

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const singleValid = form.item.trim() && form.amount && !isNaN(parseFloat(form.amount)) && parseFloat(form.amount) > 0 && form.sem.trim();

  function handleSingleSubmit(e) {
    e.preventDefault();
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
    setTimeout(() => {
      setSaved(false);
      setForm(f => ({ ...f, item: '', amount: '', qty: '1', vendor: '' }));
    }, 1200);
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
            <button type="button" className="add-exp-cancel" onClick={() => setMode(null)}>← Back</button>
            <button type="button" className="add-exp-cancel" onClick={onCancel}>Cancel</button>
            <button type="submit" className={`add-exp-save${saved ? ' is-saved' : ''}`} disabled={!singleValid}>
              {saved ? '✓ Saved' : 'Save expense'}
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
                  <input
                    className="add-exp-multi-input add-exp-multi-sm"
                    list="add-exp-multi-sems"
                    placeholder="e.g. Y3S1"
                    value={r.sem}
                    onChange={e => setRow(r._id, 'sem', e.target.value)}
                  />
                  <datalist id="add-exp-multi-sems">
                    {existingSems.map(s => <option key={s} value={s} />)}
                  </datalist>
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
