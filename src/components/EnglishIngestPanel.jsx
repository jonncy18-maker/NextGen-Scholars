import React, { useState } from 'react';
import { api } from '../lib/api.js';
import '../styles/english-tracking.css';

function fmtDuration(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

function ReviewTable({ sessions: initial, categories, onDiscard, onConfirm }) {
  const today = new Date().toISOString().slice(0, 10);
  const [sessions, setSessions] = useState(initial.map(s => ({ ...s })));
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState(null);

  function update(idx, field, value) {
    setSessions(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }
  function remove(idx) {
    setSessions(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (saving || !sessions.length) return;
    setSaving(true); setErr(null);
    try {
      await api.post('/english/sessions', {
        sessions: sessions.map(s => ({
          scholar:          s.scholar,
          date:             s.date || today,
          duration_minutes: Number(s.duration_minutes),
          activity_type:    s.category,
          category:         'conversation',
          notes:            s.notes || null,
          sem:              s.sem || null,
          period_id:        s.period_id || null,
        })),
      });
      onConfirm(sessions.length);
    } catch (e) {
      setErr(e.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="eip-review">
      <div className="eip-review-header">
        <span className="eip-ai-badge">AI · Gemini</span>
        <span className="eip-review-title">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} found — review before saving
        </span>
      </div>
      <div className="eip-review-rows">
        {sessions.map((s, idx) => (
          <div key={idx} className="eip-review-row">
            <div className="eip-review-fields">
              <label className="eip-review-field">
                <span>Date</span>
                <input type="date" value={s.date || today} max={today}
                  onChange={e => update(idx, 'date', e.target.value)} />
              </label>
              <label className="eip-review-field">
                <span>Minutes</span>
                <input type="number" min="1" max="600" value={s.duration_minutes}
                  onChange={e => update(idx, 'duration_minutes', parseInt(e.target.value, 10) || 0)}
                  style={{ width: 80 }} />
              </label>
              <label className="eip-review-field eip-review-field--wide">
                <span>Category</span>
                <select value={s.category} onChange={e => update(idx, 'category', e.target.value)}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="eip-review-field eip-review-field--notes">
                <span>Notes</span>
                <input type="text" value={s.notes || ''} placeholder="optional"
                  onChange={e => update(idx, 'notes', e.target.value)} />
              </label>
            </div>
            <div className="eip-review-dur">{fmtDuration(s.duration_minutes)}</div>
            <button className="eip-review-del" onClick={() => remove(idx)} title="Remove">×</button>
          </div>
        ))}
      </div>
      {err && <div className="eip-error">{err}</div>}
      <div className="eip-review-actions">
        <button className="eip-confirm-btn" onClick={handleSave} disabled={saving || !sessions.length}>
          {saving ? 'Saving…' : `Save ${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
        </button>
        <button className="eip-discard-btn" onClick={onDiscard} disabled={saving}>Discard</button>
      </div>
    </div>
  );
}

export function EnglishIngestPanel({ scholarKey, categories, periodId, sem, onSaved }) {
  const [text, setText]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [review, setReview]   = useState(null);
  const [success, setSuccess] = useState(null);

  async function handleExtract(e) {
    e.preventDefault();
    if (!text.trim() || loading) return;
    setLoading(true); setError(null); setReview(null); setSuccess(null);
    try {
      const res = await fetch('/api/ask-scholar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scholar: scholarKey, type: 'english_ingest', text, categories }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.status === 'not_configured') throw new Error('AI not configured — contact your mentor.');
      if (data.status === 'error') throw new Error(data.error || 'Extraction failed.');
      if (!data.sessions?.length) throw new Error('No sessions found in the text. Try pasting more detail.');
      setReview({
        sessions: data.sessions.map(s => ({
          ...s,
          scholar:   scholarKey,
          period_id: periodId,
          sem,
          category: categories.includes(s.category) ? s.category : categories[0],
        })),
        model: data.model,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDiscard() { setReview(null); setText(''); }

  function handleConfirm(count) {
    setReview(null); setText('');
    setSuccess(`${count} session${count !== 1 ? 's' : ''} saved.`);
    onSaved?.();
  }

  if (success) {
    return (
      <div className="eip-panel">
        <div className="eip-success">
          {success}
          <button className="eip-again-btn" onClick={() => setSuccess(null)}>Paste another summary</button>
        </div>
      </div>
    );
  }

  if (review) {
    return (
      <div className="eip-panel">
        <ReviewTable
          sessions={review.sessions}
          categories={categories}
          onDiscard={handleDiscard}
          onConfirm={handleConfirm}
        />
      </div>
    );
  }

  return (
    <div className="eip-panel">
      <div className="eip-header">
        <span className="eip-ai-badge">AI</span>
        <span className="eip-title">Paste your ChatGPT session summary</span>
        <span className="eip-hint">Gemini extracts sessions · you review before saving</span>
      </div>
      <form className="eip-form" onSubmit={handleExtract}>
        <textarea
          className="eip-textarea"
          rows={5}
          placeholder={"Paste your ChatGPT session summary here…\n\nExample: Today I had a 45-minute free conversation about travel, and 30 minutes of medical English vocabulary practice."}
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={loading}
        />
        {error && <div className="eip-error">{error}</div>}
        {loading && (
          <div className="eip-loading">
            <span className="eip-dot" /><span className="eip-dot" /><span className="eip-dot" />
            <span>Gemini is reading your summary…</span>
          </div>
        )}
        <button className="eip-submit" type="submit" disabled={!text.trim() || loading}>
          {loading ? '…' : 'Extract sessions'}
        </button>
      </form>
    </div>
  );
}
