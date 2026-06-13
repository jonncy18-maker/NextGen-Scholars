import React, { useState } from 'react';
import { ResultDisplay } from './NavigatorAI.jsx';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const QUICK_PROMPTS = [
  { label: 'My spending',     tpl: () => 'How much have I spent this semester?' },
  { label: 'Budget status',   tpl: () => 'Am I over budget?' },
  { label: 'My GPA',          tpl: () => 'What is my current GPA?' },
  { label: 'Next milestone',  tpl: () => 'What is my next milestone?' },
  { label: 'OET hours',       tpl: () => 'How many OET hours have I logged?' },
  { label: 'Deadlines',       tpl: () => 'What are my upcoming deadlines?' },
  { label: 'Recent expenses', tpl: () => 'Show my most recent expenses.' },
];

export function ScholarAIPanel({ scholarKey, onGoToIngestion, ingestionLabel }) {
  const [query, setQuery]     = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  async function handleAsk(e) {
    e?.preventDefault();
    const text = query.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ask-scholar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
        body: JSON.stringify({ scholar: scholarKey, type: 'query', text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data);
      setQuery('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sap-panel">
      <div className="sap-header">
        <div className="sap-header-left">
          <span className="sap-badge">AI</span>
          <span className="sap-title">Ask about your progress</span>
        </div>
        {onGoToIngestion && (
          <button className="sap-upload-btn" type="button" onClick={onGoToIngestion}>
            {ingestionLabel || 'Upload document'} →
          </button>
        )}
      </div>

      <form className="sap-form" onSubmit={handleAsk}>
        <div className="sap-row">
          <input
            className="sap-input"
            type="text"
            placeholder="Ask anything about your progress…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={loading}
            autoComplete="off"
          />
          <button className="sap-submit" type="submit" disabled={!query.trim() || loading}>
            {loading ? '…' : 'Ask'}
          </button>
        </div>
        <div className="sap-chips">
          {QUICK_PROMPTS.map(p => (
            <button
              key={p.label}
              type="button"
              className="sap-chip"
              onClick={() => setQuery(p.tpl())}
              disabled={loading}
            >
              {p.label}
            </button>
          ))}
        </div>
      </form>

      {error && <div className="sap-error">{error}</div>}

      {loading && (
        <div className="sap-loading">
          <span className="sap-dot" /><span className="sap-dot" /><span className="sap-dot" />
        </div>
      )}

      <ResultDisplay result={result} />
    </div>
  );
}
