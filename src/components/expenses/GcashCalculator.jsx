import React, { useState } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { useFmt, FxCtx } from '../../context/FxContext.jsx';
import { allExpenses } from '../../utils.js';

// GCash cash-out fee: ₱15 per ₱500 block (or any fraction of one).
// Matches the fee model from the original Jann TESDA tracker.
function gcFee(n) { return Math.ceil(n / 500) * 15; }

const peso = n =>
  '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Scoped GCash transfer helper — shown only on Janndilyne's expense entry view.
// Two directions:
//   • need → send : enter what she should RECEIVE, get the total to send (incl. fee).
//   • send → receive : enter what you SEND, get the net she receives (after fee).
export function GcashCalculator({ scholar }) {
  const { D } = useData();
  const $fmt = useFmt();
  const rate = React.useContext(FxCtx);
  const s = D.scholars[scholar] || {};
  const firstName = s.firstName || scholar;

  const [dir, setDir]           = useState('need'); // 'need' | 'send'
  const [amount, setAmount]     = useState('');
  const [selected, setSelected] = useState(() => new Set());

  const raw = parseFloat(amount) || 0;
  const fee = raw > 0 ? gcFee(raw) : 0;

  // need → send: she receives `raw`, you send raw + fee.
  // send → receive: you send `raw`, she nets raw − fee.
  const totalSend = dir === 'need' ? raw + fee : raw;
  const receives  = dir === 'need' ? raw : Math.max(raw - fee, 0);

  // GCash caps each cash-out at ₱5,000 — flag how many separate cash-outs the
  // amount landing in her wallet (the total sent) would need.
  const cashouts = totalSend > 0 ? Math.ceil(totalSend / 5000) : 0;

  // Pending (Budget) line items she still needs funded — read-only picker.
  const pending = allExpenses(s).filter(e => e.avb === 'Budget' && Number(e.amount) > 0);
  const subtotal = pending
    .filter(e => selected.has(String(e.id)))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      const k = String(id);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }
  function useSubtotal() {
    if (subtotal <= 0) return;
    setDir('need');
    setAmount(String(subtotal));
  }

  return (
    <div className="gcc-card">
      <div className="gcc-title">💸 GCash Transfer Calculator — {firstName}</div>

      <div className="gcc-grid">
        {/* ── Calculator ── */}
        <div className="gcc-box">
          <div className="gcc-dir">
            <button
              type="button"
              className={`gcc-dir-btn${dir === 'need' ? ' is-on' : ''}`}
              onClick={() => setDir('need')}
            >Need → Send</button>
            <button
              type="button"
              className={`gcc-dir-btn${dir === 'send' ? ' is-on' : ''}`}
              onClick={() => setDir('send')}
            >Send → Receive</button>
          </div>

          <label className="gcc-lbl">
            {dir === 'need'
              ? `How much should ${firstName} receive?`
              : 'How much are you sending?'}
          </label>
          <div className="gcc-input-row">
            <span className="gcc-peso">₱</span>
            <input
              className="gcc-input"
              type="number" min="0" step="0.01" placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>

          <div className="gcc-result">
            <div className="gcc-row">
              <span>{dir === 'need' ? 'Amount to receive' : 'Amount to send'}</span>
              <span className="gcc-mono">{raw > 0 ? peso(raw) : '—'}</span>
            </div>
            <div className="gcc-row">
              <span>GCash fee (₱15/₱500)</span>
              <span className="gcc-mono gcc-fee">{raw > 0 ? peso(fee) : '—'}</span>
            </div>
            <div className="gcc-divider" />
            <div className="gcc-row gcc-row-total">
              <span>{dir === 'need' ? 'Total to send' : `${firstName} receives`}</span>
              <span className="gcc-mono gcc-total-val">
                {raw > 0 ? peso(dir === 'need' ? totalSend : receives) : '—'}
              </span>
            </div>
            <div className="gcc-row gcc-row-usd">
              <span>In USD (~₱{rate}/$)</span>
              <span className="gcc-mono">{totalSend > 0 ? $fmt(totalSend, 'USD') : '—'}</span>
            </div>
          </div>

          {cashouts > 1 && (
            <div className="gcc-warn">
              ⚠ GCash caps cash-out at ₱5,000 per transaction. This needs{' '}
              <strong>{cashouts} separate cash-outs.</strong>
            </div>
          )}
        </div>

        {/* ── Pending items picker ── */}
        <div className="gcc-box">
          <label className="gcc-lbl">Pending items — select to total</label>
          <div className="gcc-hint">Tap to include in the transfer</div>
          <div className="gcc-items">
            {pending.length === 0 && (
              <div className="gcc-empty">No pending (Budget) items.</div>
            )}
            {pending.map(e => {
              const on = selected.has(String(e.id));
              return (
                <button
                  key={e.id}
                  type="button"
                  className={`gcc-item${on ? ' is-sel' : ''}`}
                  onClick={() => toggle(e.id)}
                >
                  <span className="gcc-item-name">{on ? '✓ ' : ''}{e.item}</span>
                  <span className="gcc-mono">{peso(e.amount)}</span>
                </button>
              );
            })}
          </div>
          <div className="gcc-sub">
            <span>Selected subtotal</span>
            <span className="gcc-mono gcc-sub-val">{peso(subtotal)}</span>
          </div>
          <button
            type="button"
            className="gcc-use-btn"
            onClick={useSubtotal}
            disabled={subtotal <= 0}
          >Use subtotal in calculator →</button>
        </div>
      </div>
    </div>
  );
}
