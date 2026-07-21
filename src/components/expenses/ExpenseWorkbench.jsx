import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api.js';
import { useData } from '../../context/DataContext.jsx';
import { useFmt } from '../../context/FxContext.jsx';
import { allExpenses } from '../../utils.js';
import { CAT_TO_BUCKET } from '../../constants.js';
import { GcashCalculator } from './GcashCalculator.jsx';

// Fields compared/diffed when the AI rewrites saved rows. `status` maps to the
// DB's `avb` column on write.
const EDIT_FIELDS = ['item', 'amount', 'qty', 'cat', 'date', 'vendor', 'sem', 'status'];

function slimRow(r) {
  return {
    id: String(r.id),
    item: r.item ?? '',
    amount: Number(r.amount) || 0,
    qty: Number(r.qty) || 1,
    cat: r.cat ?? 'Other',
    date: r.date ?? '',
    vendor: r.vendor ?? '',
    sem: r.sem ?? '',
    status: r.status ?? r.avb ?? 'Actual',
  };
}

function fieldEq(a, b) {
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return (a ?? '') === (b ?? '');
}

// Turn a proposed edited row into { patch, changed } relative to the original —
// patch uses DB column names (status → avb; bucket recomputed when cat changes).
function diffRow(before, after) {
  const changed = [];
  const patch = {};
  for (const f of EDIT_FIELDS) {
    if (fieldEq(before[f], after[f])) continue;
    changed.push({ field: f, before: before[f], after: after[f] });
    if (f === 'status') patch.avb = after.status;
    else if (f === 'amount') patch.amount = Number(after.amount) || 0;
    else if (f === 'qty') patch.qty = Number(after.qty) || 1;
    else patch[f] = after[f];
  }
  if ('cat' in patch) patch.bucket = CAT_TO_BUCKET[patch.cat] || before.bucket || 'college';
  return { changed, patch };
}

// ── Natural-language bulk-edit panel for already-saved expenses ───────────────
// `initialInstruction` + `autoRun` let the unified console drive this from its
// single input — it seeds the instruction and fires the preview on mount, so the
// mentor never re-types what they already said in the console.
export function ExpenseEditPanel({
  scholar,
  onEditExpense,
  onDeleteExpense,
  initialInstruction = '',
  autoRun = false,
  hideHint = false,
}) {
  const { D } = useData();
  const $fmt = useFmt();
  const [instruction, setInstruction] = useState(initialInstruction);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [proposal, setProposal] = useState(null); // { edits:[{row, changed, patch}], deletes:[row], model }
  const [applying, setApplying] = useState(false);
  const [success, setSuccess] = useState(null);

  const sd = D.scholars[scholar];
  const savedRows = sd ? allExpenses({ ...sd, _key: scholar }).map(slimRow) : [];

  function reset() {
    setProposal(null);
    setError(null);
    setSuccess(null);
  }

  async function handlePropose(e) {
    e?.preventDefault();
    const text = instruction.trim();
    if (!text || busy || savedRows.length === 0) return;
    setBusy(true);
    setError(null);
    setProposal(null);
    setSuccess(null);
    try {
      const data = await api
        .post('/ask', { scholar, type: 'expense_bulk_edit', text, rows: savedRows })
        .catch((err) => err.body ?? { error: err.message });
      if (data.error || !Array.isArray(data.rows)) {
        setError(data.error || 'The AI could not process that instruction.');
        return;
      }
      const byId = new Map(data.rows.map((r) => [String(r.id), r]));
      const edits = [];
      const deletes = [];
      for (const before of savedRows) {
        const after = byId.get(before.id);
        if (!after) {
          deletes.push(before);
          continue;
        }
        const { changed, patch } = diffRow(before, after);
        if (changed.length) edits.push({ row: before, after, changed, patch });
      }
      if (edits.length === 0 && deletes.length === 0) {
        setError('That instruction produced no changes to the saved expenses.');
        return;
      }
      setProposal({ edits, deletes, model: data.model });
    } catch (err) {
      setError(err.message ?? 'Request failed.');
    } finally {
      setBusy(false);
    }
  }

  // Fire the preview once on mount when the console pre-seeds an instruction.
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRun && !autoRanRef.current && initialInstruction.trim() && savedRows.length > 0) {
      autoRanRef.current = true;
      handlePropose();
    }
  }, [autoRun, initialInstruction, savedRows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleApply() {
    if (!proposal || applying) return;
    setApplying(true);
    setError(null);
    try {
      proposal.edits.forEach((e) => onEditExpense?.(scholar, e.row.id, e.patch));
      proposal.deletes.forEach((d) => onDeleteExpense?.(scholar, d.id));
      const n = proposal.edits.length + proposal.deletes.length;
      setProposal(null);
      setInstruction('');
      setSuccess(`Applied changes to ${n} expense${n !== 1 ? 's' : ''}.`);
    } catch (err) {
      setError(err.message ?? 'Failed to apply changes.');
    } finally {
      setApplying(false);
    }
  }

  function fmtVal(field, v) {
    if (field === 'amount') return $fmt(Number(v) || 0, 'PHP');
    if (v === '' || v == null) return '—';
    return String(v);
  }

  return (
    <div className="ewb-edit">
      {!hideHint && (
        <p className="eaw-hint" style={{ marginBottom: 10 }}>
          Fix saved expenses in plain language — e.g. <em>“change every category to Books”</em>,{' '}
          <em>“set the date on all to July 5”</em>, or <em>“delete the duplicate jeepney fare”</em>.
          You'll review every change before it's applied.
        </p>
      )}

      {savedRows.length === 0 ? (
        <div className="nai-empty">No saved expenses for {scholar} yet.</div>
      ) : (
        <>
          <form className="ewb-ask-form" onSubmit={handlePropose}>
            <input
              className="ewb-input"
              type="text"
              placeholder={`Tell the AI how to fix ${scholar}'s ${savedRows.length} saved expense${savedRows.length !== 1 ? 's' : ''}…`}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={busy || applying}
              autoComplete="off"
            />
            <button
              className="ewb-submit"
              type="submit"
              disabled={!instruction.trim() || busy || applying}
            >
              {busy ? '…' : 'Preview'}
            </button>
          </form>

          {busy && (
            <div className="nai-loading">
              <span className="nai-loading-dot" />
              <span className="nai-loading-dot" />
              <span className="nai-loading-dot" />
              <span style={{ fontSize: 12, color: 'var(--ngs-muted)', marginLeft: 4 }}>
                Gemini is working out the changes…
              </span>
            </div>
          )}
          {error && <div className="nai-error">{error}</div>}
          {success && <div className="nai-success">✓ {success}</div>}

          {proposal && (
            <div className="nai-review" style={{ marginTop: 12 }}>
              <div className="nai-review-header">
                <span className="nai-tier-badge nai-tier3-badge">Gemini</span>
                <span className="nai-review-title">
                  {proposal.edits.length} edit{proposal.edits.length !== 1 ? 's' : ''}
                  {proposal.deletes.length > 0
                    ? ` · ${proposal.deletes.length} deletion${proposal.deletes.length !== 1 ? 's' : ''}`
                    : ''}{' '}
                  — review before applying
                </span>
                {proposal.model && <span className="nai-review-model">{proposal.model}</span>}
              </div>

              <div className="ewb-edit-diffs">
                {proposal.edits.map((e) => (
                  <div key={e.row.id} className="ewb-edit-diff">
                    <div className="ewb-edit-diff-item">
                      {e.row.item || '(untitled)'}
                      <span className="nai-row-sub"> · {e.row.sem || 'no sem'}</span>
                    </div>
                    {e.changed.map((c) => (
                      <div key={c.field} className="ewb-edit-diff-field">
                        <span className="ewb-edit-diff-key">{c.field}</span>
                        <span className="ewb-edit-diff-before">{fmtVal(c.field, c.before)}</span>
                        <span className="ewb-edit-diff-arrow">→</span>
                        <span className="ewb-edit-diff-after">{fmtVal(c.field, c.after)}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {proposal.deletes.map((d) => (
                  <div key={d.id} className="ewb-edit-diff ewb-edit-diff--delete">
                    <div className="ewb-edit-diff-item">
                      {d.item || '(untitled)'}
                      <span className="nai-row-sub"> · {d.sem || 'no sem'}</span>
                    </div>
                    <div className="ewb-edit-diff-field">
                      <span className="ewb-edit-diff-key">delete</span>
                      <span className="ewb-edit-diff-after">will be removed</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="nai-review-actions">
                <button className="nai-confirm-btn" onClick={handleApply} disabled={applying}>
                  {applying
                    ? 'Applying…'
                    : `Apply ${proposal.edits.length + proposal.deletes.length} change${proposal.edits.length + proposal.deletes.length !== 1 ? 's' : ''}`}
                </button>
                <button className="nai-discard-btn" onClick={reset} disabled={applying}>
                  Discard
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Adding, uploading, and editing expenses all happen in the unified Navigator
// AI console now. What remains here is the GCash transfer calculator
// (Janndilyne only) plus a button that opens the console pre-scoped to the
// active scholar.
export function ExpenseWorkbench({ scholar, onRecordSend, onOpenConsole }) {
  const { scholarKeys } = useData();
  const [activeScholar, setActiveScholar] = useState(scholar || scholarKeys[0] || 'claire');

  // keep scholar in sync when parent expScholar changes
  useEffect(() => {
    if (scholar) setActiveScholar(scholar);
  }, [scholar]);

  return (
    <div className="ewb-panel">
      <div className="ewb-header">
        <button
          type="button"
          className="ewb-console-btn"
          onClick={() => onOpenConsole?.(activeScholar)}
        >
          ✦ Ask / edit with AI
        </button>
        <select
          className="ewb-scholar-select"
          value={activeScholar}
          onChange={(e) => setActiveScholar(e.target.value)}
        >
          {scholarKeys.map((k) => (
            <option key={k} value={k}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <p className="eaw-hint" style={{ margin: '0 0 12px' }}>
        Adding expenses, uploading receipts, and plain-language edits all happen in the{' '}
        <button
          type="button"
          className="ewb-inline-link"
          onClick={() => onOpenConsole?.(activeScholar)}
        >
          Ask AI console
        </button>{' '}
        now — just describe it and review before it saves.
      </p>

      {activeScholar === 'janndilyne' && (
        <div className="ewb-body">
          <div className="ewb-manual">
            <GcashCalculator scholar={activeScholar} onRecordSend={onRecordSend} />
          </div>
        </div>
      )}
    </div>
  );
}
