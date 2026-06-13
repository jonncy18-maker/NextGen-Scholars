import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useData } from '../context/DataContext.jsx';
import { ResultDisplay, QUICK_PROMPTS } from './NavigatorAI.jsx';

const SUPABASE_URL = 'https://rhoxpfuephkuaartuqou.supabase.co';

export function NavigatorAIDrawer({ open, onClose, onGoToIngestion }) {
  const { scholarKeys } = useData();
  const [scholar, setScholar] = useState(scholarKeys[0] || 'claire');
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
      setQuery('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

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

        <div className="nai-drawer-body">
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
        </div>

        <div className="nai-drawer-footer">
          <span className="nai-drawer-footer-label">Need to upload?</span>
          <div className="nai-drawer-upload-btns">
            <button className="nai-drawer-upload-btn" onClick={() => onGoToIngestion('ingest')}>
              Upload receipts →
            </button>
            <button className="nai-drawer-upload-btn" onClick={() => onGoToIngestion('grades')}>
              Upload grades →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
