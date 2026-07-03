import React, { useState, useRef, useEffect } from 'react';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const QUICK_PROMPTS = [
  'What is NextGen Scholars?',
  'How do I apply?',
  'What is the NCLEX pathway?',
  'What tracks are available?',
  'What is OET?',
  'What does mentorship include?',
];

let _id = 0;
const uid = () => ++_id;

export function PublicAskWidget() {
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [busy,     setBusy]     = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleOpen() { setOpen(true); }
  function handleClose() {
    setOpen(false);
    setMessages([]);
    setInput('');
  }

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const userMsg     = { id: uid(), role: 'user',      text: trimmed };
    const thinkingMsg = { id: uid(), role: 'assistant', loading: true };
    setMessages(prev => [...prev, userMsg, thinkingMsg]);
    setInput('');
    setBusy(true);

    const history = messages
      .filter(m => !m.loading && m.text)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ask-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
        body: JSON.stringify({ text: trimmed, messages: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessages(prev => prev.map(m =>
        m.loading ? { id: m.id, role: 'assistant', text: data.answer } : m
      ));
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.loading ? { id: m.id, role: 'assistant', text: null, error: err.message } : m
      ));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  const hasMessages = messages.length > 0;

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
              {!hasMessages && (
                <div className="paw-chips">
                  {QUICK_PROMPTS.map(p => (
                    <button key={p} type="button" className="paw-chip"
                      onClick={() => send(p)} disabled={busy}>
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {hasMessages && (
                <div className="paw-thread">
                  {messages.map(m => (
                    <div key={m.id} className={`paw-bubble paw-bubble--${m.role}`}>
                      {m.loading ? (
                        <span className="paw-thinking-inline">
                          <span className="paw-dot" /><span className="paw-dot" /><span className="paw-dot" />
                        </span>
                      ) : m.error ? (
                        <span className="paw-bubble-error">{m.error}</span>
                      ) : (
                        m.text
                      )}
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}

              {hasMessages && !busy && (
                <p className="paw-disclosure">AI-generated · May contain errors · Verify important details directly with the program</p>
              )}
            </div>

            <form className="paw-form" onSubmit={e => { e.preventDefault(); send(input); }}>
              <input
                ref={inputRef}
                className="paw-input"
                type="text"
                placeholder="Ask anything about the program…"
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={busy}
                autoComplete="off"
                maxLength={500}
              />
              <button className="paw-submit" type="submit"
                disabled={!input.trim() || busy} aria-label="Send">→</button>
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
