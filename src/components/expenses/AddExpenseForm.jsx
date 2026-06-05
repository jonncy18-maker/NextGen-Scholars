import React, { useState } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { EXPENSE_CATS } from '../../constants.js';

export function AddExpenseForm({ scholar, onAdd, onCancel }) {
  const { D } = useData();
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
  const [toast, setToast] = useState(false);

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
    setToast(true);
    setTimeout(() => setToast(false), 2200);
    setTimeout(() => {
      setSaved(false);
      setForm(f => ({ ...f, item: '', amount: '', qty: '1', vendor: '' }));
    }, 1200);
  }

  return (
    <>
    {toast && <div className="add-exp-toast">✓ Expense saved</div>}
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
    </>
  );
}
