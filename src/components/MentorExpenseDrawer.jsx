import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';

// Mentor-only inline expense drawer. Logs itemized actual spend against a single
// reward (a completed trip or milestone), keyed by the reward's semester. Writes
// straight to the expenses table with the given bucket ('travel' | 'milestone').
// Scholars never see this — it lives in the Navigator (mentor) modules only.

function fmtPhp(n) {
  if (!n) return '₱0';
  return '₱' + Math.round(n).toLocaleString('en-US');
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function MentorExpenseDrawer({ scholarKey, sem, bucket, cats, onAdded }) {
  const [expenses, setExpenses] = useState(null);
  const [open, setOpen]         = useState(false);
  const [item, setItem]         = useState('');
  const [cat, setCat]           = useState(cats[0]);
  const [amount, setAmount]     = useState('');
  const [date, setDate]         = useState(todayStr());
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  const load = useCallback(() => {
    if (!sem) return;
    api.get(`/expenses?scholar=${encodeURIComponent(scholarKey)}&sem=${encodeURIComponent(sem)}&bucket=${encodeURIComponent(bucket)}`)
      .then(data => setExpenses(data ?? []))
      .catch(() => setExpenses([]));
  }, [scholarKey, sem, bucket]);

  useEffect(() => { if (open) load(); }, [open, load]);

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!item.trim() || isNaN(amt) || amt <= 0) {
      setErr('Item and a positive amount are required.');
      return;
    }
    setSaving(true); setErr('');
    try {
      const id = `${scholarKey}_${sem}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await api.post('/expenses', {
        scholar: scholarKey,
        exp: { id, sem, item: item.trim(), cat, bucket, amount: amt, qty: 1, date, avb: 'Actual', sent: 'Yes', vendor: '' },
      });
      setItem(''); setAmount(''); setDate(todayStr());
      load();
      if (onAdded) onAdded();
    } catch {
      setErr('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const expTotal = (expenses ?? []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const count = expenses?.length ?? 0;

  return (
    <div className="me-wrap">
      <button className="me-toggle" onClick={() => setOpen(v => !v)} type="button">
        <span className="me-toggle-icon">{open ? '▼' : '▶'}</span>
        {count > 0 ? `Expenses · ${count}` : 'Add expenses'}
      </button>

      {open && (
        <div className="me-drawer">
          {expenses === null ? (
            <div className="me-empty">Loading…</div>
          ) : expenses.length > 0 ? (
            <>
              <div className="me-list">
                {expenses.map(e => (
                  <div key={e.id} className="me-row">
                    <span className="me-item">{e.item}</span>
                    <span className="me-cat">{e.cat}</span>
                    <span className="me-date">{fmtDate(e.date)}</span>
                    <span className="me-amt">{fmtPhp(e.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="me-total">
                <span>Total</span>
                <span>{fmtPhp(expTotal)}</span>
              </div>
            </>
          ) : (
            <div className="me-empty">No expenses logged yet.</div>
          )}

          <form className="me-form" onSubmit={handleSubmit}>
            <div className="me-field">
              <label className="me-label">Item</label>
              <input
                className="me-input"
                type="text"
                placeholder="e.g. Round-trip flight"
                value={item}
                onChange={e => setItem(e.target.value)}
              />
            </div>
            <div className="me-form-row">
              <div className="me-field">
                <label className="me-label">Category</label>
                <select className="me-select" value={cat} onChange={e => setCat(e.target.value)}>
                  {cats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="me-field">
                <label className="me-label">Amount (₱)</label>
                <input
                  className="me-input"
                  type="number" min="0" step="any"
                  placeholder="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="me-field">
              <label className="me-label">Date</label>
              <input
                className="me-input"
                type="date" value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            {err && <div className="me-err">{err}</div>}
            <button className="me-submit" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Add expense'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
