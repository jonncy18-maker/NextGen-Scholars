import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { useData } from '../context/DataContext.jsx';
import { ResultDisplay, QUICK_PROMPTS, IngestPanel, GradeIngestPanel, WeeklyReportPanel } from './NavigatorAI.jsx';

export function NavigatorAIDrawer({ open, onClose, tab = 'query', onTabChange, defaultScholar }) {
  const { scholarKeys } = useData();
  const [scholar, setScholar] = useState(defaultScholar || scholarKeys[0] || 'claire');
  const [query, setQuery]     = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [history, setHistory] = useState([]);

  async function handleAsk(e) {
    e?.preventDefault();
    const text = query.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const json = await api.post('/ask', { scholar, type: 'query', text });
      setResult(json);
      setHistory(h => [{ q: text, scholar, result: json, ts: Date.now() }, ...h].slice(0, 8));
      setQuery('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const TABS = [
    { id: 'query',  label: 'Ask' },
    { id: 'ingest', label: 'Log Expense' },
    { id: 'grades', label: 'Log Grades' },
    { id: 'report', label: 'Weekly Report' },
  ];

  return (
    <>
      <div className="nai-drawer-overlay" onClick={onClose} />
      <div className="nai-drawer" role="dialog" aria-label="Navigator AI">

        <div className="nai-drawer-header">
          <span className="nai-drawer-title">
            Navigator <span className="nai-eyebrow-badge">AI</span>
          </span>
          <button className="nai-drawer-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="nai-drawer-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`nai-drawer-tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="nai-drawer-body">

          {tab === 'query' && (
            <>
              <form className="nai-form" onSubmit={handleAsk}>
                <div className="nai-row">
                  <select
                    className="nai-scholar-select"
                    value={scholar}
                    onChange={e => setScholar(e.target.value)}
                    disabled={loading}
                  >
                    {scholarKeys.map(k => (
                      <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                    ))}
                  </select>
                  <input
                    className="nai-input"
                    type="text"
                    placeholder="Ask anything about the data…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    disabled={loading}
                    autoComplete="off"
                    autoFocus
                  />
                  <button className="nai-submit" type="submit" disabled={!query.trim() || loading}>
                    {loading ? '…' : 'Ask'}
                  </button>
                </div>
                <div className="nai-chips">
                  {QUICK_PROMPTS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      className="nai-chip"
                      onClick={() => setQuery(p.tpl(scholar))}
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
                        >↩</button>
                      </div>
                      {item.result?.tier === 1 && item.result?.answered && i > 0 && (
                        <pre className="nai-history-answer">{item.result.answer}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'ingest' && (
            <IngestPanel scholar={scholar} scholarKeys={scholarKeys} />
          )}

          {tab === 'grades' && (
            <GradeIngestPanel scholar={scholar} scholarKeys={scholarKeys} />
          )}

          {tab === 'report' && (
            <WeeklyReportPanel scholarKeys={scholarKeys} />
          )}

        </div>
      </div>
    </>
  );
}
