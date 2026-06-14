import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { writeSubmission } from '../supabase-writer.js';
import { EXPENSE_CATS, SEMESTER_OPTIONS } from '../constants.js';
import { uvToPct } from '../pages/GradeEntry.jsx';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

function gradeAvg(prelim, midterm, finalGrade) {
  const vals = [prelim, midterm, finalGrade].map(v => parseFloat(v)).filter(v => !isNaN(v));
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}

// ── Expense review card (submits to expense_submissions for mentor approval) ──

function StudentReviewCard({ items: initialItems, model, scholarKey, sem, onDiscard, onConfirmed }) {
  const [items, setItems]     = useState(initialItems.map(it => ({ ...it })));
  const [saving, setSaving]   = useState(false);
  const [saveError, setSaveError] = useState(null);

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }
  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (saving || !items.length) return;
    setSaving(true);
    setSaveError(null);
    try {
      await Promise.all(
        items.map(it => writeSubmission(scholarKey, {
          id:     `${scholarKey}_${sem}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          sem,
          item:   it.item,
          amount: Number(it.amount),
          qty:    Number(it.qty) || 1,
          cat:    it.cat,
          date:   it.date,
          avb:    'Actual',
          sent:   'No',
          vendor: it.vendor || '',
        }))
      );
      onConfirmed(items.length);
    } catch (err) {
      setSaveError(err.message ?? 'Submit failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nai-review">
      <div className="nai-review-header">
        <span className="nai-tier-badge nai-tier3-badge">Tier 3 · Gemini</span>
        <span className="nai-review-title">
          {items.length} expense{items.length !== 1 ? 's' : ''} extracted — review before submitting
        </span>
        {model && <span className="nai-review-model">{model}</span>}
      </div>

      <table className="nai-review-table">
        <thead>
          <tr>
            <th>Item</th><th>Amount (₱)</th><th>Qty</th><th>Category</th>
            <th>Date</th><th>Vendor</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td><input className="nai-review-input" value={it.item} onChange={e => updateItem(idx, 'item', e.target.value)} /></td>
              <td><input className="nai-review-input" type="number" min="0" step="0.01" value={it.amount} onChange={e => updateItem(idx, 'amount', e.target.value)} style={{ width: 90 }} /></td>
              <td><input className="nai-review-input" type="number" min="1" step="1" value={it.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} style={{ width: 50 }} /></td>
              <td>
                <select className="nai-review-select" value={it.cat} onChange={e => updateItem(idx, 'cat', e.target.value)}>
                  {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td><input className="nai-review-input" type="date" value={it.date} onChange={e => updateItem(idx, 'date', e.target.value)} style={{ width: 130 }} /></td>
              <td><input className="nai-review-input" value={it.vendor} onChange={e => updateItem(idx, 'vendor', e.target.value)} /></td>
              <td><button type="button" onClick={() => removeItem(idx)} style={{ color: 'var(--ngs-muted)', fontSize: 14, padding: '2px 6px' }}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {saveError && <div className="nai-error" style={{ marginBottom: 10 }}>{saveError}</div>}

      <div className="nai-review-actions">
        <button className="nai-confirm-btn" onClick={handleSubmit} disabled={saving || !items.length}>
          {saving ? 'Submitting…' : `Submit ${items.length} item${items.length !== 1 ? 's' : ''} for approval`}
        </button>
        <button className="nai-discard-btn" onClick={onDiscard} disabled={saving}>Discard</button>
        <span className="nai-confirm-note">Your mentor will review before expenses are recorded.</span>
      </div>
    </div>
  );
}

// ── Grade review card (saves directly to grade_entries) ──

function StudentGradeReviewCard({ grades: initialGrades, model, scholarKey, sem, onDiscard, onConfirmed }) {
  const [grades, setGrades]   = useState(initialGrades.map(g => ({ ...g })));
  const [saving, setSaving]   = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [chatLog, setChatLog]   = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

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
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ask-scholar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
        body: JSON.stringify({ scholar: scholarKey, type: 'grade_edit', grades, text: instruction }),
      });
      const data = await res.json();
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

  async function handleSave() {
    if (saving || !grades.length) return;
    setSaving(true);
    setSaveError(null);
    try {
      const entries = grades.map(g => {
        const p   = g.prelim      != null ? parseFloat(g.prelim)      : null;
        const m   = g.midterm     != null ? parseFloat(g.midterm)     : null;
        const f   = g.final_grade != null ? parseFloat(g.final_grade) : null;
        const avg = gradeAvg(p, m, f);
        return {
          scholar: scholarKey, sem,
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
      const { error } = await supabase.from('grade_entries').insert(entries);
      if (error) throw new Error(error.message);
      onConfirmed(grades.length);
    } catch (err) {
      setSaveError(err.message ?? 'Save failed.');
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
        <form className="nai-rev-chat-form" onSubmit={e => { e.preventDefault(); handleChat(); }}>
          <input
            className="nai-rev-chat-input"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="e.g. Change Nursing Science units to 5…"
            disabled={chatBusy}
          />
          <button className="nai-rev-chat-send" type="submit" disabled={chatBusy || !chatInput.trim()}>
            {chatBusy ? '…' : 'Fix →'}
          </button>
        </form>
      </div>
      {saveError && <div className="nai-error" style={{ marginBottom: 10 }}>{saveError}</div>}
      <div className="nai-review-actions">
        <button className="nai-confirm-btn" onClick={handleSave} disabled={saving || !grades.length}>
          {saving ? 'Saving…' : `Save ${grades.length} subject${grades.length !== 1 ? 's' : ''}`}
        </button>
        <button className="nai-discard-btn" onClick={onDiscard} disabled={saving}>Discard</button>
        <span className="nai-confirm-note">Edits above are applied before saving.</span>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ScholarIngestPanel({ id, type, scholarKey, sem }) {
  const isExpense = type === 'expenses';
  const [file, setFile]       = useState(null);
  const [isDragOver, setOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [review, setReview]   = useState(null);  // { items/grades, model }
  const [success, setSuccess] = useState(null);
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
      const ingestType = isExpense ? 'ingest' : 'grade_ingest';
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ask-scholar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
        body: JSON.stringify({ scholar: scholarKey, type: ingestType, sem, file }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.status === 'not_configured') throw new Error('AI not configured — contact your mentor.');
      if (data.status === 'error') throw new Error(data.error || 'Extraction failed.');
      setReview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDiscard() { setReview(null); setFile(null); setSuccess(null); }

  function handleConfirmed(count) {
    setReview(null); setFile(null);
    setSuccess(isExpense
      ? `${count} expense${count !== 1 ? 's' : ''} submitted for mentor approval.`
      : `${count} subject${count !== 1 ? 's' : ''} saved to your grade record.`
    );
  }

  const dragHandlers = {
    onDragOver:  e => { e.preventDefault(); setOver(true); },
    onDragLeave: () => setOver(false),
    onDrop,
  };

  const dropLabel = isExpense ? 'receipt or invoice' : 'grade report or transcript';

  return (
    <div className="sip-panel" id={id}>
      <div className="sip-header">
        <span className="sip-badge">AI</span>
        <span className="sip-title">{isExpense ? 'Upload receipt' : 'Upload grade report'}</span>
        <span className="sip-note">Gemini extracts the data — you review before {isExpense ? 'submitting' : 'saving'}</span>
      </div>

      {success && (
        <div className="sip-success">
          {success}
          <button className="sip-again-btn" onClick={() => setSuccess(null)}>Upload another</button>
        </div>
      )}

      {!success && !review && (
        <form onSubmit={handleExtract} onPaste={handlePaste}>
          <div
            className={`nai-drop-zone${isDragOver ? ' is-over' : ''}${file ? ' has-file' : ''}`}
            {...dragHandlers}
            role="button"
            tabIndex={0}
            aria-label={`Drop ${dropLabel} here`}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_MIME.join(',')}
              style={{ display: 'none' }}
              onChange={e => handleFileDrop(e.target.files?.[0])}
            />
            {file ? (
              <div className="nai-file-list">
                <div className="nai-file-item">
                  <span className="nai-file-icon">📄</span>
                  <span className="nai-file-name">{file.name}</span>
                  <button
                    type="button"
                    className="nai-file-remove"
                    onClick={e => { e.stopPropagation(); setFile(null); }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <div className="nai-drop-prompt">
                <span className="nai-drop-icon">⬆</span>
                <span>Drop your {dropLabel} here</span>
                <span className="nai-drop-sub">JPEG · PNG · PDF · click to browse · or paste</span>
              </div>
            )}
          </div>

          {error && <div className="nai-error">{error}</div>}

          {loading && (
            <div className="nai-loading">
              <span className="nai-loading-dot" /><span className="nai-loading-dot" /><span className="nai-loading-dot" />
              <span style={{ marginLeft: 10, fontFamily: 'var(--ngs-mono)', fontSize: 12, color: 'var(--ngs-muted)' }}>
                Gemini is reading your {isExpense ? 'receipt' : 'grade report'}…
              </span>
            </div>
          )}

          <button
            type="submit"
            className="nai-submit"
            disabled={!file || loading}
            style={{ marginTop: 12 }}
          >
            {loading ? '…' : `Extract ${isExpense ? 'expenses' : 'grades'}`}
          </button>
        </form>
      )}

      {review && isExpense && review.items && (
        <StudentReviewCard
          items={review.items}
          model={review.model}
          scholarKey={scholarKey}
          sem={sem}
          onDiscard={handleDiscard}
          onConfirmed={handleConfirmed}
        />
      )}

      {review && !isExpense && review.grades && (
        <StudentGradeReviewCard
          grades={review.grades}
          model={review.model}
          scholarKey={scholarKey}
          sem={sem}
          onDiscard={handleDiscard}
          onConfirmed={handleConfirmed}
        />
      )}
    </div>
  );
}
