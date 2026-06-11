import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useData } from '../context/DataContext.jsx';

const SUPABASE_URL = 'https://rhoxpfuephkuaartuqou.supabase.co';

const QUICK_PROMPTS = [
  { label: 'Total spend',        tpl: s => `How much has ${s} spent overall?` },
  { label: 'Budget status',      tpl: s => `Is ${s} over budget?` },
  { label: 'GPA history',        tpl: s => `How has ${s}'s GPA changed?` },
  { label: 'Pending milestones', tpl: () => 'Which milestones are still pending?' },
  { label: 'Upcoming deadlines', tpl: () => 'What are the upcoming deadlines?' },
  { label: 'OET hours',          tpl: s => `How many OET hours has ${s} logged?` },
  { label: 'Open actions',       tpl: () => 'What action items are still open?' },
  { label: 'Travel plans',       tpl: s => `What travel is planned for ${s}?` },
  { label: 'Recent expenses',    tpl: s => `Show me ${s}'s recent expenses.` },
  { label: 'Program summary',    tpl: s => `Give me a progress summary for ${s}.` },
];

// ── Intent-specific result renderers ─────────────────────────────────────────

function phpStr(n) {
  const abs = Math.abs(n);
  const fmt = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-₱' : '₱') + fmt;
}

function UrgencyChip({ urgency }) {
  return <span className={`nai-badge nai-urgency-${urgency || 'future'}`}>{urgency || 'future'}</span>;
}

function CatChip({ cat }) {
  return <span className="nai-badge nai-cat">{cat || 'general'}</span>;
}

function StateChip({ state }) {
  return <span className={`nai-badge nai-state-${state}`}>{state}</span>;
}

function SeverityChip({ severity }) {
  return <span className={`nai-badge nai-sev-${severity}`}>{severity}</span>;
}

function DeadlinesResult({ data }) {
  if (!Array.isArray(data) || !data.length) return <p className="nai-empty">No upcoming deadlines.</p>;
  return (
    <div className="nai-rows">
      {data.map((d, i) => (
        <div key={i} className="nai-row-item">
          <UrgencyChip urgency={d.urgency} />
          <span className="nai-row-primary">{d.event}</span>
          <span className="nai-row-date">{d.when_date}</span>
          <CatChip cat={d.cat} />
        </div>
      ))}
    </div>
  );
}

function MilestonesResult({ data }) {
  if (!Array.isArray(data) || !data.length) return <p className="nai-empty">No milestones found.</p>;
  return (
    <div className="nai-rows">
      {data.map((m, i) => (
        <div key={i} className="nai-row-item">
          <StateChip state={m.state} />
          <span className="nai-row-primary">{m.name}</span>
          <span className="nai-row-date">{m.sem}</span>
          {m.amount_php ? <span className="nai-row-amount">{phpStr(m.amount_php)}</span> : null}
        </div>
      ))}
    </div>
  );
}

function AlertsResult({ data }) {
  if (!Array.isArray(data) || !data.length) return <p className="nai-empty">No active alerts.</p>;
  return (
    <div className="nai-rows">
      {data.map((a, i) => (
        <div key={i} className="nai-row-item">
          <SeverityChip severity={a.severity} />
          <span className="nai-row-primary">{a.title}</span>
          {a.sub && <span className="nai-row-sub">{a.sub}</span>}
        </div>
      ))}
    </div>
  );
}

function ActionsResult({ data }) {
  if (!Array.isArray(data) || !data.length) return <p className="nai-empty">No open action items.</p>;
  return (
    <div className="nai-rows">
      {data.map((a, i) => (
        <div key={i} className="nai-row-item">
          <CatChip cat={a.cat} />
          <span className="nai-row-primary">{a.text}</span>
        </div>
      ))}
    </div>
  );
}

function GpaResult({ data }) {
  if (!Array.isArray(data) || !data.length) return <p className="nai-empty">No academic records found.</p>;
  return (
    <div className="nai-rows">
      {data.map((r, i) => (
        <div key={i} className="nai-row-item">
          <span className="nai-badge nai-cat">{r.sem}</span>
          <span className="nai-row-primary">GPA {r.gpa}</span>
          <span className={`nai-badge nai-state-${r.status === 'good standing' ? 'complete' : 'pending'}`}>{r.status}</span>
          {r.note && <span className="nai-row-sub">{r.note}</span>}
        </div>
      ))}
    </div>
  );
}

function ExpenseTotalResult({ data, answer }) {
  if (!data || data.total === undefined) return <p className="nai-answer-text">{answer}</p>;
  return (
    <div className="nai-stat-block">
      <div className="nai-stat-main">{phpStr(data.total)}</div>
      <div className="nai-stat-label">{data.count} expense{data.count !== 1 ? 's' : ''} recorded</div>
      {data.bySem && Object.keys(data.bySem).length > 0 && (
        <div className="nai-rows nai-rows-compact">
          {Object.entries(data.bySem).map(([sem, amt]) => (
            <div key={sem} className="nai-row-item">
              <span className="nai-badge nai-cat">{sem}</span>
              <span className="nai-row-amount">{phpStr(amt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BudgetResult({ data, answer }) {
  if (!data?.budgets) return <p className="nai-answer-text">{answer}</p>;
  return (
    <div className="nai-rows">
      {data.budgets.map((b, i) => {
        const spent = data.expBySem?.[b.sem] ?? 0;
        const budget = b.amount_php ?? 0;
        const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
        const over = spent > budget;
        const near = !over && spent > budget * 0.9;
        return (
          <div key={i} className="nai-row-item nai-budget-row">
            <span className="nai-badge nai-cat">{b.sem}</span>
            <span className="nai-row-primary">{phpStr(spent)} <span className="nai-row-sub">of {phpStr(budget)}</span></span>
            <span className={`nai-badge ${over ? 'nai-sev-critical' : near ? 'nai-sev-warning' : 'nai-state-complete'}`}>
              {over ? 'over budget' : `${pct}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ProgressResult({ data, answer }) {
  if (!data?.profile) return <p className="nai-answer-text">{answer}</p>;
  const { profile, latestAcademic, milestoneCount, completedMilestones } = data;
  return (
    <div className="nai-progress-block">
      <div className="nai-progress-name">{profile.name}</div>
      <div className="nai-progress-meta">
        <CatChip cat={profile.track} />
        <StateChip state={profile.status === 'active' ? 'complete' : 'pending'} />
        <span className="nai-badge nai-cat">{profile.current_sem}</span>
      </div>
      {latestAcademic && (
        <div className="nai-row-item" style={{ marginTop: 8 }}>
          <span className="nai-row-sub">Latest GPA</span>
          <span className="nai-row-primary">{latestAcademic.gpa}</span>
          <span className="nai-badge nai-cat">{latestAcademic.sem}</span>
        </div>
      )}
      <div className="nai-row-item">
        <span className="nai-row-sub">Milestones</span>
        <span className="nai-row-primary">{completedMilestones} of {milestoneCount} complete</span>
      </div>
    </div>
  );
}

function RecentExpensesResult({ data }) {
  if (!Array.isArray(data) || !data.length) return <p className="nai-empty">No expenses recorded.</p>;
  return (
    <div className="nai-rows">
      {data.map((e, i) => {
        const total = (e.amount ?? 0) * (e.qty ?? 1);
        return (
          <div key={i} className="nai-row-item">
            <span className="nai-row-date">{e.date}</span>
            <span className="nai-row-primary">{e.item}{e.vendor ? <span className="nai-row-sub"> @ {e.vendor}</span> : null}</span>
            <span className="nai-row-amount">{phpStr(total)}</span>
            <CatChip cat={e.cat} />
          </div>
        );
      })}
    </div>
  );
}

function TravelsResult({ data }) {
  if (!Array.isArray(data) || !data.length) return <p className="nai-empty">No travel records found.</p>;
  return (
    <div className="nai-rows">
      {data.map((t, i) => (
        <div key={i} className="nai-row-item">
          <StateChip state={t.state} />
          <span className="nai-row-primary">{t.dest}</span>
          <span className="nai-row-date">{t.sem}</span>
          {t.amount_php ? <span className="nai-row-amount">{phpStr(t.amount_php)}</span> : null}
        </div>
      ))}
    </div>
  );
}

function EnglishResult({ data, answer }) {
  if (!data || data.totalHours === undefined) return <p className="nai-answer-text">{answer}</p>;
  return (
    <div className="nai-stat-block">
      <div className="nai-stat-main">{data.totalHours} hrs</div>
      <div className="nai-stat-label">{data.sessions} session{data.sessions !== 1 ? 's' : ''} logged</div>
      {data.bySem && Object.keys(data.bySem).length > 0 && (
        <div className="nai-rows nai-rows-compact">
          {Object.entries(data.bySem).map(([sem, min]) => (
            <div key={sem} className="nai-row-item">
              <span className="nai-badge nai-cat">{sem}</span>
              <span className="nai-row-amount">{(min / 60).toFixed(1)} hrs</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IntentResult({ intent, data, answer }) {
  switch (intent) {
    case 'deadlines':           return <DeadlinesResult data={data} />;
    case 'milestone_status':    return <MilestonesResult data={data} />;
    case 'alerts':              return <AlertsResult data={data} />;
    case 'open_actions':        return <ActionsResult data={data} />;
    case 'gpa_trend':           return <GpaResult data={data} />;
    case 'expense_total':
    case 'expense_by_category': return <ExpenseTotalResult data={data} answer={answer} />;
    case 'budget_status':       return <BudgetResult data={data} answer={answer} />;
    case 'progress_summary':    return <ProgressResult data={data} answer={answer} />;
    case 'recent_expenses':     return <RecentExpensesResult data={data} />;
    case 'english_hours':       return <EnglishResult data={data} answer={answer} />;
    case 'travel_status':       return <TravelsResult data={data} />;
    default:                    return <p className="nai-answer-text">{answer}</p>;
  }
}

function ResultDisplay({ result }) {
  if (!result) return null;

  if (result.tier === 1 && result.answered) {
    return (
      <div className="nai-result nai-result-ok">
        <div className="nai-result-meta">
          <span className="nai-tier-badge">Tier 1 · DB</span>
          {result.intent && <span className="nai-intent">{result.intent.replace(/_/g, ' ')}</span>}
        </div>
        <IntentResult intent={result.intent} data={result.data} answer={result.answer} />
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
