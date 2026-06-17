import React, { useState, useRef, useEffect } from 'react';
import { StudentReviewCard } from './ScholarIngestPanel.jsx';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const QUICK_PROMPTS = [
  'Spent ₱850 on textbooks today',
  '₱120 jeepney fare and ₱65 lunch',
  '3 notebooks at ₱45 each',
];

// Floating button that turns plain-language text into draft expenses.
// Reuses the ask-scholar `ingest` endpoint (text mode) + the shared review card,
// so the scholar can confirm/edit before it's submitted for mentor approval.
export function ExpenseAskWidget({ scholarKey, sem }) {
  const [open,    setOpen]    = useState(false);
  const [input,   setInput]   = useState('');
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState(null);
  const [review,  setReview]  = useState(null);  // { items, model }
  const [success, setSuccess] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && !review && !success) inputRef.current?.focus();
  }, [open, review, success]);

  function handleClose() {
    setOpen(false);
    setInput('');
    setError(null);
    setReview(null);
    setSuccess(null);
  }

  function reset() {
    setInput('');
    setError(null);
    setReview(null);
    setSuccess(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function extract(text) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ask-scholar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
        body: JSON.stringify({ scholar: scholarKey, type: 'ingest', model: 'claude', text: trimmed, sem }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.status === 'not_configured') throw new Error('AI not configured — contact your mentor.');
      if (data.status === 'error') throw new Error(data.error || 'Could not read that — try rephrasing.');
      if (!Array.isArray(data.items) || data.items.length === 0) {
        throw new Error('No expense found in that. Try e.g. "₱850 on textbooks today".');
      }
      setReview({ items: data.items, model: data.model });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleConfirmed(count) {
    setReview(null);
    setInput('');
    setSuccess(`${count} expense${count !== 1 ? 's' : ''} submitted for mentor approval.`);
  }

  return (
    <div className="paw-root">
      {open && (
        <>
          <div className="paw-backdrop" onClick={handleClose} />
          <div className="paw-panel eaw-panel" role="dialog" aria-label="Add an expense with AI">
            <div className="paw-header">
              <div className="paw-header-left">
                <span className="paw-badge">AI</span>
                <span className="paw-title">Add an expense</span>
              </div>
              <button className="paw-close" onClick={handleClose} aria-label="Close">✕</button>
            </div>

            <div className="paw-body eaw-body">
              {success ? (
                <div className="eaw-success">
                  <span className="eaw-success-tick">✓</span>
                  <p>{success}</p>
                  <button className="eaw-again-btn" onClick={reset}>Add another</button>
                </div>
              ) : review ? (
                <StudentReviewCard
                  items={review.items}
                  model={review.model}
                  scholarKey={scholarKey}
                  sem={sem}
                  onDiscard={reset}
                  onConfirmed={handleConfirmed}
                />
              ) : (
                <>
                  <p className="eaw-hint">
                    Type what you spent in plain language — AI drafts the expense for you to review and submit.
                  </p>
                  <div className="paw-chips">
                    {QUICK_PROMPTS.map(p => (
                      <button key={p} type="button" className="paw-chip"
                        onClick={() => { setInput(p); extract(p); }} disabled={busy}>
                        {p}
                      </button>
                    ))}
                  </div>
                  {busy && (
                    <div className="nai-loading" style={{ marginTop: 12 }}>
                      <span className="nai-loading-dot" /><span className="nai-loading-dot" /><span className="nai-loading-dot" />
                      <span style={{ marginLeft: 10, fontFamily: 'var(--ngs-mono)', fontSize: 12, color: 'var(--ngs-muted)' }}>
                        Claude is drafting your expense…
                      </span>
                    </div>
                  )}
                  {error && <div className="nai-error" style={{ marginTop: 12 }}>{error}</div>}
                </>
              )}
            </div>

            {!review && !success && (
              <form className="paw-form" onSubmit={e => { e.preventDefault(); extract(input); }}>
                <input
                  ref={inputRef}
                  className="paw-input"
                  type="text"
                  placeholder="e.g. ₱850 on textbooks today…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={busy}
                  autoComplete="off"
                  maxLength={500}
                />
                <button className="paw-submit" type="submit"
                  disabled={!input.trim() || busy} aria-label="Draft expense">→</button>
              </form>
            )}
          </div>
        </>
      )}

      <button
        className={`paw-fab${open ? ' is-open' : ''}`}
        onClick={open ? handleClose : () => setOpen(true)}
        aria-label="Add an expense with AI"
        aria-expanded={open}
      >
        <span className="paw-fab-icon">
          {open ? '✕' : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3C7.03 3 3 6.58 3 11c0 2.3 1.05 4.37 2.75 5.87L5 21l4.5-1.8C10.6 19.71 11.29 20 12 20c4.97 0 9-3.58 9-8s-4.03-9-9-9z"
                    stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
        {!open && <span className="paw-fab-label">Add with AI</span>}
      </button>
    </div>
  );
}
