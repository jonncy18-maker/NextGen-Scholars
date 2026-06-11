import React, { useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useData } from '../context/DataContext.jsx';
import { writeExpense } from '../supabase-writer.js';
import { EXPENSE_CATS, SEMESTER_OPTIONS } from '../constants.js';

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
          <p className="nai-escalate-msg">Gemini key not configured — add <code>GOOGLE_AI_KEY</code> to Supabase secrets.</p>
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

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
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
        <span className="nai-tier-badge nai-tier3-badge">Tier 3 · Claude</span>
        <span className="nai-review-title">
          {items.length} expense{items.length !== 1 ? 's' : ''} extracted — review before saving
        </span>
        {model && <span className="nai-review-model">{model}</span>}
      </div>

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
      </table>

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

// ── Ingest panel ──────────────────────────────────────────────────────────────

function IngestPanel({ scholar, scholarKeys }) {
  const [ingestScholar, setIngestScholar] = useState(scholar);
  const [sem, setSem]         = useState('Y1S1');
  const [file, setFile]       = useState(null);   // { name, base64, mime }
  const [pasteText, setPaste] = useState('');
  const [isDragOver, setOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [review, setReview]   = useState(null);   // { items, model }
  const [success, setSuccess] = useState(null);   // count of saved items
  const fileInputRef = useRef(null);

  const readFileAsBase64 = (f) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result.split(',')[1];
      res({ name: f.name, base64: data, mime: f.type });
    };
    reader.onerror = rej;
    reader.readAsDataURL(f);
  });

  const handleFileDrop = useCallback(async (f) => {
    if (!f) return;
    if (!ACCEPTED_MIME.includes(f.type)) {
      setError(`Unsupported file type: ${f.type}. Use JPEG, PNG, WEBP, GIF, or PDF.`);
      return;
    }
    setError(null);
    setReview(null);
    setSuccess(null);
    const parsed = await readFileAsBase64(f);
    setFile(parsed);
  }, []);

  function onFileInput(e) {
    handleFileDrop(e.target.files?.[0]);
  }

  function onDrop(e) {
    e.preventDefault();
    setOver(false);
    handleFileDrop(e.dataTransfer.files?.[0]);
  }

  async function handleExtract(e) {
    e?.preventDefault();
    if (loading || (!file && !pasteText.trim())) return;
    setLoading(true);
    setError(null);
    setReview(null);
    setSuccess(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired — please refresh and log in again.');

      const body = { scholar: ingestScholar, type: 'ingest', sem };
      if (file) body.file = { base64: file.base64, mime: file.mime };
      if (pasteText.trim()) body.text = pasteText.trim();

      const res = await fetch(`${SUPABASE_URL}/functions/v1/ask`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (json.status === 'not_configured') throw new Error('Claude key not configured — add ANTHROPIC_KEY to Supabase secrets.');
      if (json.status === 'error') throw new Error(json.error || 'Extraction failed.');
      if (!Array.isArray(json.items)) throw new Error('Unexpected response from Claude.');
      if (json.items.length === 0) {
        setError('Claude found no expense line items in this document. Check the image quality or paste the text manually.');
        return;
      }
      setReview({ items: json.items, model: json.model });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDiscard() {
    setReview(null);
    setFile(null);
    setPaste('');
    setSuccess(null);
    setError(null);
  }

  function handleConfirmed(count) {
    setReview(null);
    setFile(null);
    setPaste('');
    setSuccess(count);
  }

  const canExtract = !loading && (!!file || pasteText.trim().length > 0);

  return (
    <form className="nai-ingest" onSubmit={handleExtract}>
      {/* Scholar + Semester selectors */}
      <div className="nai-ingest-row">
        <select
          className="nai-scholar-select"
          value={ingestScholar}
          onChange={e => setIngestScholar(e.target.value)}
          disabled={loading}
        >
          {scholarKeys.map(k => (
            <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
          ))}
        </select>
        <select
          className="nai-scholar-select"
          value={sem}
          onChange={e => setSem(e.target.value)}
          disabled={loading}
        >
          {SEMESTER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Drop zone */}
      <div
        className={`nai-drop-zone${isDragOver ? ' is-over' : ''}${file ? ' has-file' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        aria-label="Upload receipt image"
      >
        <span className="nai-drop-icon">📄</span>
        {file ? (
          <>
            <span className="nai-drop-label">File ready</span>
            <span className="nai-drop-file-name">{file.name}</span>
            <span className="nai-drop-sub" onClick={e => { e.stopPropagation(); setFile(null); }} style={{ cursor: 'pointer', color: 'var(--ngs-red)' }}>
              Remove
            </span>
          </>
        ) : (
          <>
            <span className="nai-drop-label">Drop a receipt image here, or click to upload</span>
            <span className="nai-drop-sub">JPEG · PNG · WEBP · PDF</span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          style={{ display: 'none' }}
          onChange={onFileInput}
          disabled={loading}
        />
      </div>

      <div className="nai-or-divider">or paste text</div>

      <textarea
        className="nai-paste-area"
        placeholder="Paste a fee schedule, receipt text, or tutor invoice here…"
        value={pasteText}
        onChange={e => setPaste(e.target.value)}
        disabled={loading}
        rows={4}
      />

      <div className="nai-ingest-row">
        <button
          className="nai-submit"
          type="submit"
          disabled={!canExtract}
          style={{ flex: 'none' }}
        >
          {loading ? '…' : 'Extract expenses'}
        </button>
        {loading && (
          <div className="nai-loading" style={{ marginBottom: 0 }}>
            <span className="nai-loading-dot" />
            <span className="nai-loading-dot" />
            <span className="nai-loading-dot" />
            <span style={{ fontSize: 12, color: 'var(--ngs-muted)', marginLeft: 4 }}>Claude is reading the document…</span>
          </div>
        )}
      </div>

      {error && <div className="nai-error">{error}</div>}

      {success !== null && (
        <div className="nai-success">
          ✓ {success} expense{success !== 1 ? 's' : ''} saved to the {sem} record for {ingestScholar}.
        </div>
      )}

      {review && (
        <ReviewCard
          items={review.items}
          model={review.model}
          scholar={ingestScholar}
          sem={sem}
          onDiscard={handleDiscard}
          onConfirmed={handleConfirmed}
        />
      )}
    </form>
  );
}

// ── Main NavigatorAI component ────────────────────────────────────────────────

export function NavigatorAI({ id, collapsed, onToggle }) {
  const { scholarKeys } = useData();
  const [tab, setTab]     = useState('query'); // 'query' | 'ingest'
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
          {/* Mode tabs */}
          <div className="nai-tabs">
            <button
              type="button"
              className={`nai-tab${tab === 'query' ? ' is-active' : ''}`}
              onClick={() => setTab('query')}
            >
              Ask the data
            </button>
            <button
              type="button"
              className={`nai-tab${tab === 'ingest' ? ' is-active' : ''}`}
              onClick={() => setTab('ingest')}
            >
              Ingest receipt
            </button>
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
                <h2 className="section-title">Ingest receipt</h2>
                <span className="section-note">Claude reads the document and proposes expense line items for your review</span>
              </div>
              <IngestPanel scholar={scholar} scholarKeys={scholarKeys} />
            </>
          )}
        </div>
      )}
    </section>
  );
}
