import React, { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useData } from '../context/DataContext.jsx';
import { writeExpense } from '../api-writer.js';
import { EXPENSE_CATS, SEMESTER_OPTIONS, SESSION_CATEGORIES } from '../constants.js';
import { uvToPct } from '../screens/GradeEntry.jsx';
import { EnglishIngestPanel } from './EnglishIngestPanel.jsx';

function gradeAvg(prelim, midterm, finalGrade) {
  const vals = [prelim, midterm, finalGrade].map(v => parseFloat(v)).filter(v => !isNaN(v));
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}

export const QUICK_PROMPTS = [
  { label: 'Total spend',        tpl: s => `How much has ${s} spent overall?` },
  { label: 'Budget status',      tpl: s => `Is ${s} over budget?` },
  { label: 'GPA history',        tpl: s => `How has ${s}'s GPA changed?` },
  { label: 'Pending milestones', tpl: () => 'Which milestones are still pending?' },
  { label: 'Upcoming deadlines', tpl: () => 'What are the upcoming deadlines?' },
  { label: 'OET hours',          tpl: s => `How many OET hours has ${s} logged?` },
  { label: 'OET readiness',     tpl: s => `OET readiness assessment for ${s}` },
  { label: 'Open actions',       tpl: () => 'What action items are still open?' },
  { label: 'Travel plans',       tpl: s => `What travel is planned for ${s}?` },
  { label: 'Recent expenses',    tpl: s => `Show me ${s}'s recent expenses.` },
  { label: 'Program summary',    tpl: s => `Give me a progress summary for ${s}.` },
];

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

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

export function ResultDisplay({ result }) {
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
    if (result.answer) {
      return (
        <div className="nai-result nai-result-escalate">
          <div className="nai-result-meta">
            <span className="nai-tier-badge nai-tier-2">Tier 2 · Gemini</span>
            {result.model && <span className="nai-intent">{result.model}</span>}
          </div>
          <p className="nai-answer-text nai-gemini-answer">{result.answer}</p>
          <p className="nai-ai-disclosure">AI-generated · May contain errors · Verify important details with official sources</p>
        </div>
      );
    }
    if (result.status === 'not_configured') {
      return (
        <div className="nai-result nai-result-escalate">
          <div className="nai-result-meta">
            <span className="nai-tier-badge nai-tier-2">Tier 2 · Gemini</span>
          </div>
          <p className="nai-escalate-msg">Gemini key not configured — add <code>GOOGLE_AI_KEY</code> to the Vercel project's env vars.</p>
        </div>
      );
    }
    return (
      <div className="nai-result nai-result-escalate">
        <div className="nai-result-meta">
          <span className="nai-tier-badge nai-tier-2">Tier 2 · Gemini</span>
        </div>
        <p className="nai-escalate-msg nai-error">{result.error ?? 'Gemini returned an unexpected response.'}</p>
      </div>
    );
  }

  return null;
}

// ── Ingest review card ────────────────────────────────────────────────────────

function ReviewCard({ items: initialItems, model, scholar, sem, onDiscard, onConfirmed }) {
  const [items, setItems] = useState(initialItems.map(it => ({ ...it })));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [chatLog, setChatLog]   = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleChat() {
    const instruction = chatInput.trim();
    if (!instruction || chatBusy) return;
    setChatLog(prev => [...prev, { role: 'user', text: instruction }]);
    setChatInput('');
    setChatBusy(true);
    try {
      const data = await api.post('/ask-scholar', { scholar, type: 'expense_edit', items, text: instruction }).catch(err => err.body ?? { error: err.message });
      if (data.items) {
        setItems(data.items.map(it => ({ ...it })));
        setChatLog(prev => [...prev, { role: 'ai', text: 'Done — expenses updated. Review the table above.' }]);
      } else {
        setChatLog(prev => [...prev, { role: 'ai', text: data.error ?? 'Could not apply the edit.' }]);
      }
    } catch (err) {
      setChatLog(prev => [...prev, { role: 'ai', text: err.message ?? 'Request failed.' }]);
    } finally {
      setChatBusy(false);
    }
  }

  async function handleConfirm() {
    if (saving || !items.length) return;
    setSaving(true);
    setSaveError(null);
    try {
      await Promise.all(
        items.map(it => writeExpense(scholar, {
          sem,
          item:   it.item,
          amount: Number(it.amount),
          qty:    Number(it.qty) || 1,
          cat:    it.cat,
          date:   it.date,
          vendor: it.vendor || '',
          avb:    'Actual',
          sent:   'No',
        }))
      );
      onConfirmed(items.length);
    } catch (err) {
      setSaveError(err.message ?? 'Write failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nai-review">
      <div className="nai-review-header">
        <span className="nai-tier-badge nai-tier3-badge">Tier 3 · Gemini</span>
        <span className="nai-review-title">
          {items.length} expense{items.length !== 1 ? 's' : ''} extracted — review before saving
        </span>
        {model && <span className="nai-review-model">{model}</span>}
      </div>

      <div className="nai-review-table-wrap">
      <table className="nai-review-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Amount (₱)</th>
            <th>Qty</th>
            <th>Category</th>
            <th>Date</th>
            <th>Vendor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td>
                <input
                  className="nai-review-input"
                  value={it.item}
                  onChange={e => updateItem(idx, 'item', e.target.value)}
                />
              </td>
              <td>
                <input
                  className="nai-review-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={it.amount}
                  onChange={e => updateItem(idx, 'amount', e.target.value)}
                  style={{ width: 90 }}
                />
              </td>
              <td>
                <input
                  className="nai-review-input"
                  type="number"
                  min="1"
                  step="1"
                  value={it.qty}
                  onChange={e => updateItem(idx, 'qty', e.target.value)}
                  style={{ width: 50 }}
                />
              </td>
              <td>
                <select
                  className="nai-review-select"
                  value={it.cat}
                  onChange={e => updateItem(idx, 'cat', e.target.value)}
                >
                  {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td>
                <input
                  className="nai-review-input"
                  type="date"
                  value={it.date}
                  onChange={e => updateItem(idx, 'date', e.target.value)}
                  style={{ width: 130 }}
                />
              </td>
              <td>
                <input
                  className="nai-review-input"
                  value={it.vendor}
                  onChange={e => updateItem(idx, 'vendor', e.target.value)}
                />
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  title="Remove this line"
                  style={{ color: 'var(--ngs-muted)', fontSize: 14, padding: '2px 6px' }}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        {items.length > 0 && (() => {
          const total = items.reduce((s, it) => s + Number(it.amount) * (Number(it.qty) || 1), 0);
          return (
            <tfoot>
              <tr>
                <td colSpan={6} style={{ padding: '8px 8px', borderTop: '2px solid var(--ngs-rule)', fontWeight: 700, fontSize: 13, color: 'var(--ngs-navy)', textAlign: 'right', fontFamily: 'var(--ngs-mono)' }}>
                  Total
                </td>
                <td style={{ padding: '8px 8px', borderTop: '2px solid var(--ngs-rule)', fontWeight: 700, fontSize: 13, color: 'var(--ngs-navy)', fontFamily: 'var(--ngs-mono)' }}>
                  ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          );
        })()}
      </table>
      </div>

      <div className="nai-rev-chat">
        {chatLog.length > 0 && (
          <div className="nai-rev-chat-log">
            {chatLog.map((m, i) => (
              <div key={i} className={`nai-rev-chat-msg ${m.role === 'user' ? 'nai-rev-chat-user' : 'nai-rev-chat-ai'}`}>
                {m.text}
              </div>
            ))}
          </div>
        )}
        <div className="nai-rev-chat-form">
          <input
            className="nai-rev-chat-input"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
            placeholder="e.g. Change tuition amount to 5000, remove the last item…"
            disabled={chatBusy}
          />
          <button className="nai-rev-chat-send" type="button" onClick={handleChat} disabled={chatBusy || !chatInput.trim()}>
            {chatBusy ? '…' : 'Fix →'}
          </button>
        </div>
      </div>

      {saveError && <div className="nai-error" style={{ marginBottom: 10 }}>{saveError}</div>}

      <div className="nai-review-actions">
        <button
          className="nai-confirm-btn"
          onClick={handleConfirm}
          disabled={saving || !items.length}
        >
          {saving ? 'Saving…' : `Confirm & save ${items.length} item${items.length !== 1 ? 's' : ''}`}
        </button>
        <button className="nai-discard-btn" onClick={onDiscard} disabled={saving}>
          Discard
        </button>
        <span className="nai-confirm-note">Edits above are applied before saving.</span>
      </div>
    </div>
  );
}

// ── Grade review card ─────────────────────────────────────────────────────────

function GradeReviewCard({ grades: initialGrades, model, scholar, sem, onDiscard, onConfirmed }) {
  const [grades, setGrades] = useState(initialGrades.map(g => ({ ...g })));
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [chatLog, setChatLog]   = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [geminiAnalysis, setGeminiAnalysis] = useState(null);
  const [geminiLoading, setGeminiLoading] = useState(false);

  useEffect(() => {
    if (!initialGrades.length) return;
    setGeminiLoading(true);
    api.post('/ask-scholar', { scholar, sem, type: 'grade_analysis', grades: initialGrades })
      .then(data => { if (data.analysis) setGeminiAnalysis(data.analysis); })
      .catch(() => {})
      .finally(() => setGeminiLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function updateGrade(idx, field, value) {
    setGrades(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g));
  }
  function removeGrade(idx) {
    setGrades(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleChat() {
    const instruction = chatInput.trim();
    if (!instruction || chatBusy) return;
    setChatLog(prev => [...prev, { role: 'user', text: instruction }]);
    setChatInput('');
    setChatBusy(true);
    try {
      const data = await api.post('/ask-scholar', { scholar, type: 'grade_edit', grades, text: instruction }).catch(err => err.body ?? { error: err.message });
      if (data.grades) {
        setGrades(data.grades.map(g => ({ ...g })));
        setChatLog(prev => [...prev, { role: 'ai', text: 'Done — grades updated. Review the table above.' }]);
      } else {
        setChatLog(prev => [...prev, { role: 'ai', text: data.error ?? 'Could not apply the edit.' }]);
      }
    } catch (err) {
      setChatLog(prev => [...prev, { role: 'ai', text: err.message ?? 'Request failed.' }]);
    } finally {
      setChatBusy(false);
    }
  }

  async function handleConfirm() {
    if (saving || !grades.length) return;
    setSaving(true);
    setSaveError(null);
    try {
      const entries = grades.map(g => {
        const p = g.prelim      != null ? parseFloat(g.prelim)      : null;
        const m = g.midterm     != null ? parseFloat(g.midterm)     : null;
        const f = g.final_grade != null ? parseFloat(g.final_grade) : null;
        const avg = gradeAvg(p, m, f);
        return {
          scholar, sem,
          school:      g.school || 'uv',
          subject:     g.subject,
          units:       parseFloat(g.units) || 3,
          prelim:      isNaN(p) ? null : p,
          midterm:     isNaN(m) ? null : m,
          final_grade: isNaN(f) ? null : f,
          period_avg:  avg,
          pct_equiv:   avg != null ? (g.school === 'k12' ? avg : uvToPct(avg)) : null,
        };
      });
      await api.post('/grades', { entries });
      onConfirmed(grades.length);
    } catch (err) {
      setSaveError(err.message ?? 'Write failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nai-review">
      <div className="nai-review-header">
        <span className="nai-tier-badge nai-tier3-badge">Tier 3 · Gemini</span>
        <span className="nai-review-title">
          {grades.length} subject{grades.length !== 1 ? 's' : ''} extracted — review before saving
        </span>
        {model && <span className="nai-review-model">{model}</span>}
      </div>
      <table className="nai-review-table">
        <thead>
          <tr><th>Subject</th><th>Units</th><th>Scale</th><th>Prelim</th><th>Mid</th><th>Final</th><th>Avg</th><th>%</th><th></th></tr>
        </thead>
        <tbody>
          {grades.map((g, idx) => {
            const avg = gradeAvg(g.prelim, g.midterm, g.final_grade);
            const pct = avg != null ? (g.school === 'k12' ? avg : uvToPct(avg)) : null;
            return (
              <tr key={idx}>
                <td><input className="nai-review-input" value={g.subject} onChange={e => updateGrade(idx, 'subject', e.target.value)} /></td>
                <td><input className="nai-review-input" type="number" min="0.5" max="9" step="0.5" value={g.units ?? 3} onChange={e => updateGrade(idx, 'units', e.target.value)} style={{ width: 50 }} /></td>
                <td>
                  <select className="nai-review-select" value={g.school || 'uv'} onChange={e => updateGrade(idx, 'school', e.target.value)}>
                    <option value="uv">UV</option>
                    <option value="k12">K-12</option>
                  </select>
                </td>
                <td><input className="nai-review-input" type="number" value={g.prelim ?? ''} onChange={e => updateGrade(idx, 'prelim', e.target.value === '' ? null : e.target.value)} style={{ width: 65 }} /></td>
                <td><input className="nai-review-input" type="number" value={g.midterm ?? ''} onChange={e => updateGrade(idx, 'midterm', e.target.value === '' ? null : e.target.value)} style={{ width: 65 }} /></td>
                <td><input className="nai-review-input" type="number" value={g.final_grade ?? ''} onChange={e => updateGrade(idx, 'final_grade', e.target.value === '' ? null : e.target.value)} style={{ width: 65 }} /></td>
                <td className="nai-review-computed">{avg != null ? avg.toFixed(2) : '—'}</td>
                <td className="nai-review-computed">{pct != null ? `${pct.toFixed(1)}%` : '—'}</td>
                <td><button type="button" onClick={() => removeGrade(idx)} style={{ color: 'var(--ngs-muted)', fontSize: 14, padding: '2px 6px' }}>✕</button></td>
              </tr>
            );
          })}
        </tbody>
        {grades.length > 1 && (() => {
          const valid = grades.filter(g => {
            const avg = gradeAvg(g.prelim, g.midterm, g.final_grade);
            return avg != null && parseFloat(g.units) > 0;
          });
          const totalUnits = valid.reduce((s, g) => s + (parseFloat(g.units) || 0), 0);
          const wa = totalUnits ? valid.reduce((s, g) => {
            const avg = gradeAvg(g.prelim, g.midterm, g.final_grade);
            return s + avg * (parseFloat(g.units) || 0);
          }, 0) / totalUnits : null;
          const isK12 = valid.every(g => g.school === 'k12');
          const waPct = wa != null ? (isK12 ? wa : uvToPct(wa)) : null;
          if (wa == null) return null;
          return (
            <tfoot>
              <tr>
                <td style={{ padding: '8px 8px', borderTop: '2px solid var(--ngs-rule)', fontWeight: 700, fontSize: 12, color: 'var(--ngs-navy)', fontFamily: 'var(--ngs-mono)' }}>
                  Weighted Avg
                </td>
                <td style={{ padding: '8px 8px', borderTop: '2px solid var(--ngs-rule)', fontWeight: 700, fontSize: 12, color: 'var(--ngs-navy)', fontFamily: 'var(--ngs-mono)' }}>
                  {totalUnits} u
                </td>
                <td colSpan={4} style={{ borderTop: '2px solid var(--ngs-rule)' }} />
                <td className="nai-review-computed" style={{ borderTop: '2px solid var(--ngs-rule)', fontWeight: 700, color: 'var(--ngs-navy)' }}>
                  {wa.toFixed(2)}
                </td>
                <td className="nai-review-computed" style={{ borderTop: '2px solid var(--ngs-rule)', fontWeight: 700, color: 'var(--ngs-navy)' }}>
                  {waPct != null ? `${waPct.toFixed(1)}%` : '—'}
                </td>
                <td style={{ borderTop: '2px solid var(--ngs-rule)' }} />
              </tr>
            </tfoot>
          );
        })()}
      </table>
      <div className="nai-rev-chat">
        {chatLog.length > 0 && (
          <div className="nai-rev-chat-log">
            {chatLog.map((m, i) => (
              <div key={i} className={`nai-rev-chat-msg ${m.role === 'user' ? 'nai-rev-chat-user' : 'nai-rev-chat-ai'}`}>
                {m.text}
              </div>
            ))}
          </div>
        )}
        <div className="nai-rev-chat-form">
          <input
            className="nai-rev-chat-input"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
            placeholder="e.g. Change Nursing Science units to 5…"
            disabled={chatBusy}
          />
          <button className="nai-rev-chat-send" type="button" onClick={handleChat} disabled={chatBusy || !chatInput.trim()}>
            {chatBusy ? '…' : 'Fix →'}
          </button>
        </div>
      </div>
      {(geminiLoading || geminiAnalysis) && (
        <div className="nai-gemini-analysis">
          <span className="nai-tier-badge nai-tier-2" style={{ marginBottom: 6, display: 'inline-block' }}>Gemini · Analysis</span>
          {geminiLoading
            ? <p className="nai-gemini-analysis-text" style={{ color: 'var(--ngs-muted)' }}>Gemini is reviewing the grades…</p>
            : <p className="nai-gemini-analysis-text">{geminiAnalysis}</p>
          }
        </div>
      )}
      {saveError && <div className="nai-error" style={{ marginBottom: 10 }}>{saveError}</div>}
      <div className="nai-review-actions">
        <button className="nai-confirm-btn" onClick={handleConfirm} disabled={saving || !grades.length}>
          {saving ? 'Saving…' : `Confirm & save ${grades.length} subject${grades.length !== 1 ? 's' : ''}`}
        </button>
        <button className="nai-discard-btn" onClick={onDiscard} disabled={saving}>Discard</button>
        <span className="nai-confirm-note">Edits above are applied before saving.</span>
      </div>
    </div>
  );
}

// ── Grade ingest panel ────────────────────────────────────────────────────────

export function GradeIngestPanel({ scholar, scholarKeys }) {
  const [gradeScholar, setGradeScholar] = useState(scholar);
  const [sem, setSem]           = useState('Y1S1');
  const [file, setFile]         = useState(null);
  const [isDragOver, setOver]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [review, setReview]     = useState(null);
  const [success, setSuccess]   = useState(null);
  const fileInputRef = useRef(null);

  const readFileAsBase64 = (f) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res({ name: f.name, base64: reader.result.split(',')[1], mime: f.type });
    reader.onerror = rej;
    reader.readAsDataURL(f);
  });

  async function handleFileDrop(f) {
    if (!f) return;
    if (!ACCEPTED_MIME.includes(f.type)) { setError(`Unsupported file type: ${f.type}.`); return; }
    setError(null); setReview(null); setSuccess(null);
    setFile(await readFileAsBase64(f));
  }

  function onDrop(e) { e.preventDefault(); setOver(false); handleFileDrop(e.dataTransfer.files?.[0]); }

  function handlePaste(e) {
    const item = Array.from(e.clipboardData?.items || []).find(i => i.kind === 'file' && i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    const raw = item.getAsFile();
    const ext = raw.type.split('/')[1] || 'png';
    handleFileDrop(new File([raw], `screenshot-${Date.now()}.${ext}`, { type: raw.type }));
  }

  async function handleExtract(e) {
    e?.preventDefault();
    if (loading || !file) return;
    setLoading(true); setError(null); setReview(null); setSuccess(null);
    try {
      const json = await api.post('/ask', { scholar: gradeScholar, type: 'grade_ingest', sem, file: { base64: file.base64, mime: file.mime } });
      if (!Array.isArray(json.grades)) throw new Error('Unexpected response from Gemini.');
      if (json.grades.length === 0) { setError('Gemini found no grade entries in this document.'); return; }
      setReview({ grades: json.grades, model: json.model });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="nai-ingest" onSubmit={handleExtract}>
      <div className="nai-ingest-row">
        <select className="nai-scholar-select" value={gradeScholar} onChange={e => setGradeScholar(e.target.value)} disabled={loading}>
          {scholarKeys.map(k => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
        </select>
        <select className="nai-scholar-select" value={sem} onChange={e => setSem(e.target.value)} disabled={loading}>
          {SEMESTER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div
        className={`nai-drop-zone${isDragOver ? ' is-over' : ''}${file ? ' has-file' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        aria-label="Upload grade report"
      onPaste={handlePaste}
      >
        <span className="nai-drop-icon">🎓</span>
        {file ? (
          <>
            <span className="nai-drop-label">File ready</span>
            <span className="nai-drop-file-name">{file.name}</span>
            <span className="nai-drop-sub" onClick={e => { e.stopPropagation(); setFile(null); }} style={{ cursor: 'pointer', color: 'var(--ngs-red)' }}>Remove</span>
          </>
        ) : (
          <>
            <span className="nai-drop-label">Drop a grade report or transcript screenshot</span>
            <span className="nai-drop-sub">JPEG · PNG · WEBP · PDF · or paste</span>
          </>
        )}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          style={{ display: 'none' }} onChange={e => handleFileDrop(e.target.files?.[0])} disabled={loading} />
      </div>

      <div className="nai-ingest-row">
        <button className="nai-submit" type="submit" disabled={loading || !file} style={{ flex: 'none' }}>
          {loading ? '…' : 'Extract grades'}
        </button>
        {loading && (
          <div className="nai-loading" style={{ marginBottom: 0 }}>
            <span className="nai-loading-dot" /><span className="nai-loading-dot" /><span className="nai-loading-dot" />
            <span style={{ fontSize: 12, color: 'var(--ngs-muted)', marginLeft: 4 }}>Gemini is reading the grade report…</span>
          </div>
        )}
      </div>

      {error && <div className="nai-error">{error}</div>}
      {success !== null && (
        <div className="nai-success">✓ {success} subject{success !== 1 ? 's' : ''} saved to the {sem} record for {gradeScholar}.</div>
      )}
      {review && (
        <GradeReviewCard
          grades={review.grades} model={review.model}
          scholar={gradeScholar} sem={sem}
          onDiscard={() => { setReview(null); setFile(null); setSuccess(null); setError(null); }}
          onConfirmed={count => { setReview(null); setFile(null); setSuccess(count); }}
        />
      )}
    </form>
  );
}

// ── Ingest panel ──────────────────────────────────────────────────────────────

export function IngestPanel({ scholar, scholarKeys }) {
  const [ingestScholar, setIngestScholar] = useState(scholar);
  const [sem, setSem]           = useState('Y1S1');
  const [files, setFiles]       = useState([]);   // [{ name, base64, mime }]
  const [pasteText, setPaste]   = useState('');
  const [isDragOver, setOver]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError]       = useState(null);
  const [review, setReview]     = useState(null);
  const [success, setSuccess]   = useState(null);
  const fileInputRef = useRef(null);

  const readFileAsBase64 = (f) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res({ name: f.name, base64: reader.result.split(',')[1], mime: f.type });
    reader.onerror = rej;
    reader.readAsDataURL(f);
  });

  const addFiles = useCallback(async (fileList) => {
    const arr = Array.from(fileList);
    const valid   = arr.filter(f => ACCEPTED_MIME.includes(f.type));
    const invalid = arr.filter(f => !ACCEPTED_MIME.includes(f.type));
    if (invalid.length) setError(`${invalid.length} file(s) skipped — unsupported type.`);
    else setError(null);
    const parsed = await Promise.all(valid.map(readFileAsBase64));
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...parsed.filter(f => !existing.has(f.name))];
    });
    setReview(null); setSuccess(null);
  }, []);

  function onFileInput(e) { if (e.target.files?.length) addFiles(e.target.files); }

  function onDrop(e) {
    e.preventDefault(); setOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  function handlePaste(e) {
    const item = Array.from(e.clipboardData?.items || []).find(i => i.kind === 'file' && i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    const raw = item.getAsFile();
    const ext = raw.type.split('/')[1] || 'png';
    addFiles([new File([raw], `screenshot-${Date.now()}.${ext}`, { type: raw.type })]);
  }

  async function handleExtract(e) {
    e?.preventDefault();
    if (loading || (files.length === 0 && !pasteText.trim())) return;
    setLoading(true); setError(null); setReview(null); setSuccess(null);
    try {
      const allItems = [];
      let usedModel = 'gemini-2.5-flash';
      const modelLabel = 'Gemini';

      if (pasteText.trim()) {
        setProgress('Processing pasted text…');
        const json = await api.post('/ask', { scholar: ingestScholar, type: 'ingest', sem, text: pasteText.trim() });
        if (json.model) usedModel = json.model;
        if (Array.isArray(json.items)) allItems.push(...json.items);
      }

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress(files.length > 1 ? `Processing file ${i + 1} of ${files.length}…` : `${modelLabel} is reading the document…`);
        const json = await api.post('/ask', { scholar: ingestScholar, type: 'ingest', sem, file: { base64: f.base64, mime: f.mime } });
        if (json.model) usedModel = json.model;
        if (Array.isArray(json.items)) allItems.push(...json.items);
      }

      if (allItems.length === 0) {
        setError('No expense line items found in any of the provided documents.');
        return;
      }
      setReview({ items: allItems, model: usedModel });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false); setProgress('');
    }
  }

  function handleDiscard() {
    setReview(null); setFiles([]); setPaste(''); setSuccess(null); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleConfirmed(count) {
    setReview(null); setFiles([]); setPaste(''); setSuccess(count);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const canExtract = !loading && (files.length > 0 || pasteText.trim().length > 0);

  return (
    <form className="nai-ingest" onSubmit={handleExtract} onPaste={handlePaste}>
      <div className="nai-ingest-row">
        <select className="nai-scholar-select" value={ingestScholar} onChange={e => setIngestScholar(e.target.value)} disabled={loading}>
          {scholarKeys.map(k => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
        </select>
        <select className="nai-scholar-select" value={sem} onChange={e => setSem(e.target.value)} disabled={loading}>
          {SEMESTER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Drop zone */}
      <div
        className={`nai-drop-zone${isDragOver ? ' is-over' : ''}${files.length > 0 ? ' has-file' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        aria-label="Upload receipt images"
      >
        <span className="nai-drop-icon">📄</span>
        {files.length > 0 ? (
          <>
            <span className="nai-drop-label">{files.length} file{files.length !== 1 ? 's' : ''} ready</span>
            <span className="nai-drop-sub">Click to add more</span>
          </>
        ) : (
          <>
            <span className="nai-drop-label">Drop receipt images here, or click to upload</span>
            <span className="nai-drop-sub">JPEG · PNG · WEBP · PDF · Multiple files · or paste</span>
          </>
        )}
        <input ref={fileInputRef} type="file" multiple
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          style={{ display: 'none' }} onChange={onFileInput} disabled={loading} />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="nai-file-list">
          {files.map(f => (
            <div key={f.name} className="nai-file-item">
              <span className="nai-file-name">{f.name}</span>
              <button type="button" className="nai-file-remove"
                onClick={() => setFiles(prev => prev.filter(x => x.name !== f.name))}
                disabled={loading}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="nai-or-divider">or paste text</div>

      <textarea className="nai-paste-area"
        placeholder="Paste a fee schedule, receipt text, or tutor invoice here…"
        value={pasteText} onChange={e => setPaste(e.target.value)}
        disabled={loading} rows={4} />

      <div className="nai-ingest-row">
        <button className="nai-submit" type="submit" disabled={!canExtract} style={{ flex: 'none' }}>
          {loading ? '…' : files.length > 1 ? `Extract ${files.length} receipts` : 'Extract expenses'}
        </button>
        {loading && (
          <div className="nai-loading" style={{ marginBottom: 0 }}>
            <span className="nai-loading-dot" /><span className="nai-loading-dot" /><span className="nai-loading-dot" />
            <span style={{ fontSize: 12, color: 'var(--ngs-muted)', marginLeft: 4 }}>{progress || 'Gemini is reading the document…'}</span>
          </div>
        )}
      </div>

      {error && <div className="nai-error">{error}</div>}
      {success !== null && (
        <div className="nai-success">✓ {success} expense{success !== 1 ? 's' : ''} saved to the {sem} record for {ingestScholar}.</div>
      )}
      {review && (
        <ReviewCard items={review.items} model={review.model} scholar={ingestScholar} sem={sem}
          onDiscard={handleDiscard} onConfirmed={handleConfirmed} />
      )}
    </form>
  );
}

// ── English hours ingest panel (Navigator AI english-only mode) ───────────────

function EnglishHoursIngestPanel({ scholarKeys }) {
  const [scholar, setScholar] = useState(scholarKeys[0] || 'claire');
  const [period, setPeriod]   = useState(undefined); // undefined = loading, null = none found
  const [key, setKey]         = useState(0);

  useEffect(() => {
    setPeriod(undefined);
    api.get(`/english/periods?scholar=${encodeURIComponent(scholar)}`)
      .then(data => setPeriod(data?.[0] ?? null))
      .catch(() => setPeriod(null));
  }, [scholar]);

  const cats = period
    ? (SESSION_CATEGORIES[period.session_type] ?? SESSION_CATEGORIES.default)
    : SESSION_CATEGORIES.default;

  return (
    <div>
      <div className="nai-ingest-row" style={{ marginBottom: 12 }}>
        <select
          className="nai-scholar-select"
          value={scholar}
          onChange={e => { setScholar(e.target.value); setKey(k => k + 1); }}
        >
          {scholarKeys.map(k => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
        </select>
        {period && (
          <span className="section-note" style={{ marginLeft: 10 }}>
            {period.label || period.session_type} · {period.start_date?.slice(0,7)} – {period.end_date?.slice(0,7)}
          </span>
        )}
        {period === null && (
          <span className="section-note" style={{ marginLeft: 10, color: 'var(--ngs-warn, #b45309)' }}>
            No active period — sessions will be saved without a period link
          </span>
        )}
      </div>
      {period === undefined && <div className="nai-thinking">Loading period…</div>}
      {period !== undefined && (
        <EnglishIngestPanel
          key={`${scholar}-${key}`}
          scholarKey={scholar}
          categories={cats}
          periodId={period?.id ?? null}
          sem={period?.sem ?? null}
        />
      )}
    </div>
  );
}

// ── Weekly cohort report panel (Tier 2) ───────────────────────────────────────

export function WeeklyReportPanel({ scholarKeys }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport]   = useState(null);
  const [model, setModel]     = useState(null);
  const [error, setError]     = useState(null);
  const [copied, setCopied]   = useState(false);

  async function generate() {
    if (loading) return;
    setLoading(true); setError(null); setReport(null); setCopied(false);
    try {
      const json = await api.post('/ask', { scholar: 'all', scholars: scholarKeys, type: 'weekly_report' });
      if (!json.report) throw new Error(json.error || 'Gemini returned an empty report.');
      setReport(json.report);
      setModel(json.model);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }

  return (
    <>
      <div className="section-head">
        <h2 className="section-title">Weekly report</h2>
        <span className="section-note">Gemini drafts a shareable cohort update from every scholar's live data</span>
      </div>

      <div className="nai-ingest-row">
        <button className="nai-submit" type="button" onClick={generate} disabled={loading} style={{ flex: 'none' }}>
          {loading ? '…' : report ? 'Regenerate report' : 'Generate weekly report'}
        </button>
        {loading && (
          <div className="nai-loading" style={{ marginBottom: 0 }}>
            <span className="nai-loading-dot" /><span className="nai-loading-dot" /><span className="nai-loading-dot" />
            <span style={{ fontSize: 12, color: 'var(--ngs-muted)', marginLeft: 4 }}>Gemini is reviewing the cohort…</span>
          </div>
        )}
      </div>

      {error && <div className="nai-error">{error}</div>}

      {report && (
        <div className="nai-result nai-result-escalate" style={{ marginTop: 12 }}>
          <div className="nai-result-meta">
            <span className="nai-tier-badge nai-tier-2">Tier 2 · Gemini</span>
            {model && <span className="nai-intent">{model}</span>}
            <button
              type="button"
              className="nai-history-rerun"
              onClick={copyReport}
              title="Copy report to clipboard"
              style={{ marginLeft: 'auto' }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="nai-answer-text nai-gemini-answer" style={{ whiteSpace: 'pre-wrap' }}>{report}</p>
          <p className="nai-ai-disclosure">AI-generated · May contain errors · Verify important details with official sources</p>
        </div>
      )}
    </>
  );
}

// ── Main NavigatorAI component ────────────────────────────────────────────────

export function NavigatorAI({ id, collapsed, onToggle, englishOnly = false }) {
  const { scholarKeys } = useData();
  const [tab, setTab]     = useState(englishOnly ? 'english_hours' : 'query'); // 'query' | 'ingest' | 'grades' | 'report' | 'english_hours'
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

  function usePrompt(tpl) {
    setQuery(tpl(scholar));
  }

  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        Navigator
        <span className="nai-eyebrow-badge">AI</span>
        <span className="eyebrow-rule" />
        <button className="section-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand section' : 'Collapse section'}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="nai-panel">
          {/* Mode tabs */}
          <div className="nai-tabs">
            {!englishOnly && (
              <button
                type="button"
                className={`nai-tab${tab === 'query' ? ' is-active' : ''}`}
                onClick={() => setTab('query')}
              >
                Ask the data
              </button>
            )}
            {!englishOnly && (
              <button
                type="button"
                className={`nai-tab${tab === 'ingest' ? ' is-active' : ''}`}
                onClick={() => setTab('ingest')}
              >
                Upload receipts
              </button>
            )}
            {!englishOnly && (
              <button
                type="button"
                className={`nai-tab${tab === 'grades' ? ' is-active' : ''}`}
                onClick={() => setTab('grades')}
              >
                Upload grades
              </button>
            )}
            {!englishOnly && (
              <button
                type="button"
                className={`nai-tab${tab === 'report' ? ' is-active' : ''}`}
                onClick={() => setTab('report')}
              >
                Weekly report
              </button>
            )}
            {englishOnly && (
              <button
                type="button"
                className={`nai-tab is-active`}
              >
                Upload English hours
              </button>
            )}
          </div>

          {tab === 'query' && (
            <>
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
            </>
          )}

          {tab === 'ingest' && (
            <>
              <div className="section-head">
                <h2 className="section-title">Upload receipts</h2>
                <span className="section-note">Gemini reads one or more documents and proposes expense line items for your review</span>
              </div>
              <IngestPanel scholar={scholar} scholarKeys={scholarKeys} />
            </>
          )}

          {tab === 'grades' && (
            <>
              <div className="section-head">
                <h2 className="section-title">Upload grade report</h2>
                <span className="section-note">Upload a grade report screenshot — Gemini extracts all subjects and grades for review</span>
              </div>
              <GradeIngestPanel scholar={scholar} scholarKeys={scholarKeys} />
            </>
          )}

          {tab === 'report' && !englishOnly && (
            <WeeklyReportPanel scholarKeys={scholarKeys} />
          )}

          {(tab === 'english_hours' || englishOnly) && (
            <>
              <div className="section-head">
                <h2 className="section-title">Upload English hours</h2>
                <span className="section-note">Paste a ChatGPT session summary — Gemini extracts hours for your review before saving</span>
              </div>
              <EnglishHoursIngestPanel scholarKeys={scholarKeys} />
            </>
          )}
        </div>
      )}
    </section>
  );
}
