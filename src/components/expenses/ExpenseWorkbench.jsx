import React, { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useData } from '../../context/DataContext.jsx';
import { ResultDisplay, QUICK_PROMPTS, IngestPanel } from '../NavigatorAI.jsx';
import { AddExpenseForm } from './AddExpenseForm.jsx';

const SUPABASE_URL = 'https://rhoxpfuephkuaartuqou.supabase.co';

const EXPENSE_PROMPTS = QUICK_PROMPTS.filter(p =>
  ['Total spend', 'Budget status', 'Pending milestones', 'Recent expenses'].includes(p.label)
);

const TABS = [
  { id: 'ask',    label: 'Ask AI' },
  { id: 'upload', label: 'Upload Receipt' },
  { id: 'manual', label: 'Add Manually' },
];

export function ExpenseWorkbench({ scholar, onAddExpense }) {
  const { scholarKeys } = useData();
  const [activeScholar, setActiveScholar] = useState(scholar || scholarKeys[0] || 'claire');
  const [tab, setTab]       = useState('ask');
  const [query, setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError]   = useState(null);
  const [history, setHistory] = useState([]);

  // keep scholar in sync when parent expScholar changes
  React.useEffect(() => { if (scholar) setActiveScholar(scholar); }, [scholar]);

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
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scholar: activeScholar, type: 'query', text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setResult(json);
      setHistory(h => [{ q: text, scholar: activeScholar, result: json, ts: Date.now() }, ...h].slice(0, 6));
      setQuery('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ewb-panel">
      <div className="ewb-header">
        <div className="ewb-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`ewb-tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >{t.label}</button>
          ))}
        </div>
        <select
          className="ewb-scholar-select"
          value={activeScholar}
          onChange={e => setActiveScholar(e.target.value)}
        >
          {scholarKeys.map(k => (
            <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="ewb-body">

        {tab === 'ask' && (
          <div className="ewb-ask">
            <form className="ewb-ask-form" onSubmit={handleAsk}>
              <input
                className="ewb-input"
                type="text"
                placeholder="Ask anything about expenses, budget, or spend…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                disabled={loading}
                autoComplete="off"
              />
              <button className="ewb-submit" type="submit" disabled={!query.trim() || loading}>
                {loading ? '…' : 'Ask'}
              </button>
            </form>
            <div className="ewb-chips">
              {EXPENSE_PROMPTS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  className="nai-chip"
                  onClick={() => setQuery(p.tpl(activeScholar))}
                  disabled={loading}
                >{p.label}</button>
              ))}
              {QUICK_PROMPTS.filter(p => !EXPENSE_PROMPTS.includes(p)).slice(0, 3).map(p => (
                <button
                  key={p.label}
                  type="button"
                  className="nai-chip nai-chip--dim"
                  onClick={() => setQuery(p.tpl(activeScholar))}
                  disabled={loading}
                >{p.label}</button>
              ))}
            </div>

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
              <div className="nai-history ewb-history">
                <div className="nai-history-label">Recent</div>
                {history.map(item => (
                  <div key={item.ts} className="nai-history-item">
                    <div className="nai-history-q">
                      <span className={`scholar-tag t-${item.scholar}`}>{item.scholar}</span>
                      <span className="nai-history-text">{item.q}</span>
                      <button
                        className="nai-history-rerun"
                        title="Re-run"
                        onClick={() => { setActiveScholar(item.scholar); setQuery(item.q); }}
                      >↩</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'upload' && (
          <div className="ewb-upload">
            <IngestPanel scholar={activeScholar} scholarKeys={scholarKeys} />
          </div>
        )}

        {tab === 'manual' && (
          <div className="ewb-manual">
            <AddExpenseForm
              scholar={activeScholar}
              onAdd={(sk, exp) => onAddExpense?.(sk, exp)}
              onCancel={() => setTab('ask')}
            />
          </div>
        )}

      </div>
    </div>
  );
}
