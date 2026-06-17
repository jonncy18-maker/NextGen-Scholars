import React, { useState } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { useFmt, FxCtx } from '../../context/FxContext.jsx';
import { allExpenses } from '../../utils.js';
import { supabase } from '../../lib/supabase.js';

const SUPABASE_URL = 'https://rhoxpfuephkuaartuqou.supabase.co';

// GCash cash-out fee: ₱15 per ₱500 block (or any fraction of one).
// Matches the fee model from the original Jann TESDA tracker.
function gcFee(n) { return Math.ceil(n / 500) * 15; }

const peso = n =>
  '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Scoped GCash transfer helper — shown only on Janndilyne's expense entry view.
//   • Calculator: Need → Send (gross-up) and Send → Receive (net).
//   • Picker: select the unsent items a transfer covers.
//   • Record send: log the GCash fee as an expense and mark the covered items
//     (plus the fee) sent — either by button or by describing it to the AI.
export function GcashCalculator({ scholar, onRecordSend }) {
  const { D } = useData();
  const $fmt = useFmt();
  const rate = React.useContext(FxCtx);
  const s = D.scholars[scholar] || {};
  const firstName = s.firstName || scholar;

  const [dir, setDir]           = useState('need'); // 'need' | 'send'
  const [amount, setAmount]     = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [toast, setToast]       = useState(null);   // { kind: 'ok'|'err', text }

  // AI "record a send" box
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  const raw = parseFloat(amount) || 0;
  const fee = raw > 0 ? gcFee(raw) : 0;

  // need → send: she receives `raw`, you send raw + fee.
  // send → receive: you send `raw`, she nets raw − fee.
  const totalSend = dir === 'need' ? raw + fee : raw;
  const receives  = dir === 'need' ? raw : Math.max(raw - fee, 0);

  // GCash caps each cash-out at ₱5,000 — flag how many separate cash-outs the
  // amount landing in her wallet (the total sent) would need.
  const cashouts = totalSend > 0 ? Math.ceil(totalSend / 5000) : 0;

  // Items she still needs funded = unsent line items.
  const pending = allExpenses(s).filter(e => e.sent !== 'Yes' && Number(e.amount) > 0);
  const selectedItems = pending.filter(e => selected.has(String(e.id)));
  const subtotal = selectedItems.reduce((sum, e) => sum + Number(e.amount), 0);
  const recordFee = subtotal > 0 ? gcFee(subtotal) : 0;

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

  function flash(kind, text) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4000);
  }

  // Record the send for the currently-selected items.
  function recordSelected() {
    if (!onRecordSend || selectedItems.length === 0) return;
    const sem = selectedItems[0].sem || s.currentSem || '';
    onRecordSend(scholar, { itemIds: selectedItems.map(e => String(e.id)), fee: recordFee, sem });
    flash('ok', `Recorded ₱${recordFee.toLocaleString('en-PH')} fee · marked ${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''} + fee sent`);
    setSelected(new Set());
  }

  // Describe a send in words; the AI resolves which unsent items it covers,
  // then we record the fee and mark them sent immediately.
  async function recordViaAI(e) {
    e?.preventDefault();
    const text = aiText.trim();
    if (!text || aiBusy) return;
    setAiBusy(true);
    setToast(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired — refresh and log in again.');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ask`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scholar, type: 'action', text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      if (json.action === 'record_send' && Array.isArray(json.items) && json.items.length > 0) {
        const items = json.items;
        const sem = items[0].sem || s.currentSem || '';
        const feeAmt = Number(json.fee) || gcFee(items.reduce((sum, it) => sum + Number(it.amount || 0), 0));
        onRecordSend?.(scholar, { itemIds: items.map(it => String(it.id)), fee: feeAmt, sem });
        const names = items.map(it => it.item).join(', ');
        flash('ok', `Recorded ₱${feeAmt.toLocaleString('en-PH')} fee · marked sent: ${names}`);
        setAiText('');
      } else {
        // No confident match — surface the AI's clarification instead of writing.
        flash('err', json.note || json.answer || 'Could not match that to any unsent items — try naming them.');
      }
    } catch (err) {
      flash('err', err.message);
    } finally {
      setAiBusy(false);
    }
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

        {/* ── Unsent items picker + record ── */}
        <div className="gcc-box">
          <label className="gcc-lbl">Unsent items — select what this transfer covers</label>
          <div className="gcc-hint">Tap to include; recording marks them (and the fee) sent</div>
          <div className="gcc-items">
            {pending.length === 0 && (
              <div className="gcc-empty">Nothing unsent — all caught up.</div>
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
          {subtotal > 0 && (
            <div className="gcc-sub gcc-sub-fee">
              <span>+ GCash fee → total to send</span>
              <span className="gcc-mono">{peso(subtotal + recordFee)}</span>
            </div>
          )}
          <div className="gcc-actions">
            <button
              type="button"
              className="gcc-use-btn gcc-use-btn--ghost"
              onClick={useSubtotal}
              disabled={subtotal <= 0}
            >Use in calculator →</button>
            <button
              type="button"
              className="gcc-use-btn"
              onClick={recordSelected}
              disabled={subtotal <= 0}
            >Record send · mark {selectedItems.length || ''} + fee sent</button>
          </div>
        </div>
      </div>

      {/* ── Record a send by describing it (AI) ── */}
      <form className="gcc-ai" onSubmit={recordViaAI}>
        <label className="gcc-lbl">Or record a send in words</label>
        <div className="gcc-ai-row">
          <input
            className="gcc-ai-input"
            type="text"
            placeholder="e.g. “Sent for July & August transport and the OJT fee”"
            value={aiText}
            onChange={e => setAiText(e.target.value)}
            disabled={aiBusy}
            autoComplete="off"
          />
          <button className="gcc-ai-submit" type="submit" disabled={!aiText.trim() || aiBusy}>
            {aiBusy ? '…' : 'Record'}
          </button>
        </div>
        <div className="gcc-ai-hint">
          The AI matches your words to {firstName}’s unsent items, logs the GCash fee, and marks them sent.
        </div>
      </form>

      {toast && (
        <div className={`gcc-toast gcc-toast--${toast.kind}`}>{toast.text}</div>
      )}
    </div>
  );
}
