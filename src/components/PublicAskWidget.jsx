import React, { useState } from 'react';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const QUICK_PROMPTS = [
  'What is NextGen Scholars?',
  'How do I apply?',
  'What is the NCLEX pathway?',
  'What tracks are available?',
  'What is OET?',
  'What does mentorship include?',
];

export function PublicAskWidget() {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer]   = useState(null);
  const [error, setError]     = useState(null);

  function handleOpen() {
    setOpen(true);
    setAnswer(null);
    setError(null);
  }

  function handleClose() {
    setOpen(false);
    setAnswer(null);
    setError(null);
    setQuery('');
  }

  async function handleAsk(e) {
    e?.preventDefault();
    const text = query.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ask-public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON,
        },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setAnswer(data.answer);
      setQuery('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="paw-root">
      {open && (
        <>
          <div className="paw-backdrop" onClick={handleClose} />
          <div className="paw-panel" role="dialog" aria-label="Ask about the program">
            <div className="paw-header">
              <div className="paw-header-left">
                <span className="paw-badge">AI</span>
                <span className="paw-title">Ask about the program</span>
              </div>
              <button className="paw-close" onClick={handleClose} aria-label="Close">✕</button>
            </div>

            <div className="paw-body">
              {!answer && !loading && (
                <div className="paw-chips">
                  {QUICK_PROMPTS.map(p => (
                    <button
                      key={p}
                      type="button"
                      className="paw-chip"
                      onClick={() => setQuery(p)}
                      disabled={loading}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {loading && (
                <div className="paw-thinking">
                  <span className="paw-dot" /><span className="paw-dot" /><span className="paw-dot" />
                </div>
              )}

              {error && <div className="paw-error">{error}</div>}

              {answer && (
                <div className="paw-answer">
                  <p className="paw-answer-text">{answer}</p>
                  <p className="paw-disclosure">AI-generated · May contain errors · Verify important details directly with the program</p>
                  <button
                    type="button"
                    className="paw-ask-another"
                    onClick={() => { setAnswer(null); setError(null); }}
                  >
                    Ask another question
                  </button>
                </div>
              )}
            </div>

            <form className="paw-form" onSubmit={handleAsk}>
              <input
                className="paw-input"
                type="text"
                placeholder="Ask anything about the program…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                disabled={loading}
                autoComplete="off"
                autoFocus={!answer}
                maxLength={500}
              />
              <button
                className="paw-submit"
                type="submit"
                disabled={!query.trim() || loading}
                aria-label="Send"
              >
                →
              </button>
            </form>
          </div>
        </>
      )}

      <button
        className={`paw-fab${open ? ' is-open' : ''}`}
        onClick={open ? handleClose : handleOpen}
        aria-label="Ask about the program"
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
        {!open && <span className="paw-fab-label">Ask AI</span>}
      </button>
    </div>
  );
}
