import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useData } from '../context/DataContext.jsx';

const SUPABASE_URL = 'https://rhoxpfuephkuaartuqou.supabase.co';

const QUICK_PROMPTS = [
  { label: 'Total spend',     tpl: s => `How much has ${s} spent overall?` },
  { label: 'Budget status',   tpl: s => `Is ${s} over budget?` },
  { label: 'GPA history',     tpl: s => `How has ${s}'s GPA changed?` },
  { label: 'Pending milestones', tpl: () => 'Which milestones are still pending?' },
  { label: 'Upcoming deadlines', tpl: () => 'What are the upcoming deadlines?' },
  { label: 'OET hours',       tpl: s => `How many OET hours has ${s} logged?` },
  { label: 'Open actions',    tpl: () => 'What action items are still open?' },
];

function ResultDisplay({ result }) {
  if (!result) return null;

  if (result.tier === 1 && result.answered) {
    return (
      <div className="nai-result nai-result-ok">
        <div className="nai-result-meta">
          <span className="nai-tier-badge">Tier 1 · DB</span>
          {result.intent && <span className="nai-intent">{result.intent.replace(/_/g, ' ')}</span>}
        </div>
        <pre className="nai-answer">{result.answer}</pre>
      </div>
    );
  }

  if (result.tier === 2) {
    return (
      <div className="nai-result nai-result-escalate">
        <div className="nai-result-meta">
          <span className="nai-tier-badge nai-tier-2">Tier 2 · Gemini</span>
        </div>
        <p className="nai-escalate-msg">
          This question needs outside knowledge or reasoning — Gemini advisory is coming in the next step.
        </p>
      </div>
    );
  }

  return null;
}

export function NavigatorAI({ id, collapsed, onToggle }) {
  const { scholarKeys } = useData();
  const [scholar, setScholar] = useState(scholarKeys[0] || 'claire');
  const [query, setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [history, setHistory] = useState([]); // [{ q, scholar, result, ts }]

  async function handleAsk(e) {
    e?.preventDefault();
    const text = query.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired — please refresh and log in again.');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ask`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scholar, type: 'query', text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setResult(json);
      setHistory(h => [{ q: text, scholar, result: json, ts: Date.now() }, ...h].slice(0, 8));
      setQuery('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function usePrompt(tpl) {
    setQuery(tpl(scholar));
  }

  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        <span className="num">06</span> Navigator
        <span className="nai-eyebrow-badge">AI</span>
        <span className="eyebrow-rule" />
        <button className="section-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand section' : 'Collapse section'}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="nai-panel">
          <div className="section-head">
            <h2 className="section-title">Ask the data</h2>
            <span className="section-note">Tier 1 answers come directly from the database — no AI cost</span>
          </div>

          <form className="nai-form" onSubmit={handleAsk}>
            <div className="nai-row">
              <select
                className="nai-scholar-select"
                value={scholar}
                onChange={e => setScholar(e.target.value)}
              >
                {scholarKeys.map(k => (
                  <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                ))}
              </select>
              <input
                className="nai-input"
                type="text"
                placeholder="Ask anything about the scholar data…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                disabled={loading}
                autoComplete="off"
              />
              <button
                className="nai-submit"
                type="submit"
                disabled={!query.trim() || loading}
              >
                {loading ? '…' : 'Ask'}
              </button>
            </div>

            <div className="nai-chips">
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  className="nai-chip"
                  onClick={() => usePrompt(p.tpl)}
                  disabled={loading}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </form>

          {error && <div className="nai-error">{error}</div>}

          {loading && (
            <div className="nai-loading">
              <span className="nai-loading-dot" />
              <span className="nai-loading-dot" />
              <span className="nai-loading-dot" />
            </div>
          )}

          <ResultDisplay result={result} />

          {history.length > 0 && (
            <div className="nai-history">
              <div className="nai-history-label">Recent queries</div>
              {history.map((item, i) => (
                <div key={item.ts} className="nai-history-item">
                  <div className="nai-history-q">
                    <span className={`scholar-tag t-${item.scholar}`}>{item.scholar}</span>
                    <span className="nai-history-text">{item.q}</span>
                    <button
                      className="nai-history-rerun"
                      title="Re-run this query"
                      onClick={() => { setScholar(item.scholar); setQuery(item.q); }}
                    >
                      ↩
                    </button>
                  </div>
                  {item.result?.tier === 1 && item.result?.answered && i > 0 && (
                    <pre className="nai-history-answer">{item.result.answer}</pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
