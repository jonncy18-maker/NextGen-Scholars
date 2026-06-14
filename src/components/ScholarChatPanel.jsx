import React, { useState, useRef, useEffect } from 'react';
import { ResultDisplay } from './NavigatorAI.jsx';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const QUICK_PROMPTS = [
  { label: 'My spending',     text: 'How much have I spent this semester?' },
  { label: 'Budget status',   text: 'Am I over budget?' },
  { label: 'My GPA',          text: 'What is my current GPA?' },
  { label: 'Next milestone',  text: 'What is my next milestone?' },
  { label: 'OET hours',       text: 'How many OET hours have I logged?' },
  { label: 'Deadlines',       text: 'What are my upcoming deadlines?' },
  { label: 'Recent expenses', text: 'Show my most recent expenses.' },
];

let _id = 0;
const uid = () => ++_id;

function resultToText(result) {
  if (!result) return '';
  if (result.answer) return result.answer;
  if (result.intent && result.data != null) return `[${result.intent}] ${JSON.stringify(result.data)}`;
  return '';
}

export function ScholarChatPanel({ scholarKey, onGoToIngestion, ingestionLabel }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [busy, setBusy]         = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const userMsg     = { id: uid(), role: 'user',      text: trimmed };
    const thinkingMsg = { id: uid(), role: 'assistant', loading: true };
    setMessages(prev => [...prev, userMsg, thinkingMsg]);
    setInput('');
    setBusy(true);

    // Prior turns for multi-turn context (exclude current and loading bubbles)
    const history = messages
      .filter(m => !m.loading)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.role === 'user' ? m.text : resultToText(m.result) }))
      .filter(m => m.text);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ask-scholar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
        body: JSON.stringify({ scholar: scholarKey, type: 'query', text: trimmed, messages: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessages(prev => prev.map(m => m.loading
        ? { id: m.id, role: 'assistant', result: data, text: resultToText(data) }
        : m
      ));
    } catch (err) {
      setMessages(prev => prev.map(m => m.loading
        ? { id: m.id, role: 'assistant', error: err.message }
        : m
      ));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  const hasThread = messages.length > 0;

  return (
    <div className="scp-panel">
      {/* Header */}
      <div className="scp-header">
        <div className="scp-header-left">
          <span className="sap-badge">AI</span>
          <span className="sap-title">Ask about your progress</span>
        </div>
        {hasThread && (
          <button className="scp-clear-btn" type="button" onClick={() => setMessages([])}>
            Clear
          </button>
        )}
        {onGoToIngestion && (
          <button className="sap-upload-btn" type="button" onClick={onGoToIngestion}>
            {ingestionLabel || 'Upload document'} →
          </button>
        )}
      </div>

      {/* Empty state: quick prompts only */}
      {!hasThread && (
        <div className="scp-empty">
          <p className="scp-empty-hint">Start a conversation or pick a topic:</p>
          <div className="sap-chips">
            {QUICK_PROMPTS.map(p => (
              <button key={p.label} type="button" className="sap-chip"
                onClick={() => send(p.text)} disabled={busy}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message thread */}
      {hasThread && (
        <div className="scp-thread">
          {messages.map(m => (
            <div key={m.id} className={`scp-msg scp-msg-${m.role}`}>
              {m.loading ? (
                <div className="scp-bubble scp-bubble-assistant">
                  <span className="sap-dot" /><span className="sap-dot" /><span className="sap-dot" />
                </div>
              ) : m.role === 'user' ? (
                <div className="scp-bubble scp-bubble-user">{m.text}</div>
              ) : m.error ? (
                <div className="scp-bubble scp-bubble-assistant scp-bubble-err">{m.error}</div>
              ) : (
                <div className="scp-bubble scp-bubble-assistant">
                  {m.result?.answer
                    ? <p className="scp-answer">{m.result.answer}</p>
                    : <ResultDisplay result={m.result} />
                  }
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input row */}
      <form className="scp-form" onSubmit={e => { e.preventDefault(); send(input); }}>
        <input
          ref={inputRef}
          className="sap-input"
          type="text"
          placeholder={hasThread ? 'Continue the conversation…' : 'Ask anything about your progress…'}
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={busy}
          autoComplete="off"
        />
        <button className="sap-submit scp-send-btn" type="submit" disabled={!input.trim() || busy}>
          {busy ? '…' : '↑'}
        </button>
      </form>

      {/* Compact quick-prompt chips while thread is active */}
      {hasThread && (
        <div className="scp-chips-bar">
          {QUICK_PROMPTS.map(p => (
            <button key={p.label} type="button" className="sap-chip scp-chip-sm"
              onClick={() => send(p.text)} disabled={busy}>
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
