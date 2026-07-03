import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase, SUPABASE_URL } from '../lib/supabase.js';
import { ScholarChatPanel } from '../components/ScholarChatPanel.jsx';
import { ScholarIngestPanel } from '../components/ScholarIngestPanel.jsx';
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

const SEM_LABELS = {
  Y1S1:'Year 1 · Semester 1', Y1S2:'Year 1 · Semester 2',
  Y2S1:'Year 2 · Semester 1', Y2S2:'Year 2 · Semester 2',
  Y3S1:'Year 3 · Semester 1', Y3S2:'Year 3 · Semester 2',
  Y4S1:'Year 4 · Semester 1', Y4S2:'Year 4 · Semester 2',
  TG11S1:'Grade 11 · Semester 1', TG11S2:'Grade 11 · Semester 2',
  TG12S1:'Grade 12 · Semester 1', TG12S2:'Grade 12 · Semester 2',
};

const CONFIGS = {
  claire: { name: 'Claire', semKey: 'Y2S2', semLabel: 'Year 2 · Semester 2', homeHref: '/home/claire',
    semOrder: ['Y2S1', 'Y2S2', 'Y3S1', 'Y3S2'], defaultSchool: 'uv' },
  april:  { name: 'April',  semKey: 'TG11S1', semLabel: 'Grade 11 · Semester 1', homeHref: '/home/april',
    semOrder: ['TG11S1', 'TG11S2', 'TG12S1', 'TG12S2'], defaultSchool: 'k12' },
};

// UV grade scale — linear interpolation within each bracket (contiguous, no gaps)
const UV_BRACKETS = [
  { min: 1.00, max: 1.09, minPct: 95.00, maxPct: 100.00, desc: 'Excellent' },
  { min: 1.10, max: 1.59, minPct: 90.00, maxPct:  94.99, desc: 'Superior' },
  { min: 1.60, max: 2.09, minPct: 85.00, maxPct:  89.99, desc: 'Very Good' },
  { min: 2.10, max: 2.59, minPct: 80.00, maxPct:  84.99, desc: 'Good' },
  { min: 2.60, max: 2.99, minPct: 76.00, maxPct:  79.99, desc: 'Fair' },
  { min: 3.00, max: 4.99, minPct: 75.00, maxPct:  75.00, desc: 'Pass' },
  { min: 5.00, max: 5.00, minPct:  0.00, maxPct:   0.00, desc: 'Failing' },
];

export function uvToPct(grade) {
  const g = parseFloat(grade);
  if (!g || g <= 0) return null;
  if (g === 5.0) return 0;
  const b = UV_BRACKETS.find(b => g >= b.min && g <= b.max);
  if (!b || b.min === b.max) return b?.minPct ?? null;
  const pct = b.minPct + (b.max - g) / (b.max - b.min) * (b.maxPct - b.minPct);
  return Math.round(pct * 100) / 100;
}

export function uvDesc(grade) {
  const g = parseFloat(grade);
  if (!g) return '';
  return UV_BRACKETS.find(b => g >= b.min && g <= b.max)?.desc ?? '';
}

function k12Desc(pct) {
  const p = parseFloat(pct);
  if (isNaN(p)) return '';
  if (p >= 90) return 'Outstanding';
  if (p >= 85) return 'Very Satisfactory';
  if (p >= 80) return 'Satisfactory';
  if (p >= 75) return 'Fairly Satisfactory';
  return 'Did Not Meet Expectations';
}

const SCHOOLS = [
  { value: 'uv',  label: 'UV (1.0 – 5.0 scale)' },
  { value: 'k12', label: 'K-12 DepEd (% grade)'  },
];

function weightedGpa(rows) {
  const valid = rows.filter(r => r.period_avg && r.units);
  if (!valid.length) return null;
  const totalUnits = valid.reduce((s, r) => s + (r.units || 0), 0);
  return totalUnits ? valid.reduce((s, r) => s + r.period_avg * r.units, 0) / totalUnits : null;
}

const emptyForm = (school = 'uv') => ({ subject: '', units: '3', prelim: '', midterm: '', final_grade: '', school });

// ── Review panel: editable table + AI chat to fix extracted grades ────────────

const SCHOOLS_OPT = [{ value: 'uv', label: 'UV' }, { value: 'k12', label: 'K-12' }];

function ReviewPanel({ review, setReview, scholarKey, sem, loading, error, onConfirm, onBack }) {
  const [chatInput, setChatInput] = useState('');
  const [chatBusy,  setChatBusy]  = useState(false);
  const [chatError, setChatError] = useState(null);
  const [chatLog,   setChatLog]   = useState([]); // [{role, text}]
  const [geminiAnalysis, setGeminiAnalysis] = useState(null);
  const [geminiLoading, setGeminiLoading] = useState(false);

  useEffect(() => {
    if (!review.length) return;
    setGeminiLoading(true);
    fetch(`${SUPABASE_URL}/functions/v1/ask-scholar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      body: JSON.stringify({ scholar: scholarKey, sem, type: 'grade_analysis', grades: review }),
    })
      .then(r => r.json())
      .then(data => { if (data.analysis) setGeminiAnalysis(data.analysis); })
      .catch(() => {})
      .finally(() => setGeminiLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setField(i, field, val) {
    setReview(prev => prev.map((g, idx) => idx === i ? { ...g, [field]: val } : g));
  }
  function removeRow(i) {
    setReview(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleChat(e) {
    e.preventDefault();
    const instruction = chatInput.trim();
    if (!instruction || chatBusy) return;
    setChatLog(prev => [...prev, { role: 'user', text: instruction }]);
    setChatInput('');
    setChatBusy(true); setChatError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ask-scholar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
        body: JSON.stringify({ scholar: scholarKey, type: 'grade_edit', text: instruction, grades: review }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.grades)) throw new Error(data.error || 'AI could not update grades.');
      setReview(data.grades);
      setChatLog(prev => [...prev, { role: 'ai', text: `Done — updated ${data.grades.length} subject${data.grades.length !== 1 ? 's' : ''}.` }]);
    } catch (err) {
      setChatError(err.message);
      setChatLog(prev => [...prev, { role: 'ai', text: `Error: ${err.message}` }]);
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <div>
      <p className="ge-ai-import-hint">
        {review.length} subject{review.length !== 1 ? 's' : ''} found. Edit cells directly or ask AI to fix.
      </p>

      {/* Editable review table */}
      <div className="ge-review-wrap">
        <table className="ge-review-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Scale</th>
              <th>Units</th>
              <th>Prelim</th>
              <th>Mid</th>
              <th>Final</th>
              <th>Avg</th>
              <th>%</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {review.map((g, i) => {
              const avg = (() => { const vals = [g.prelim, g.midterm, g.final_grade].map(v => parseFloat(v)).filter(v => !isNaN(v)); return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null; })();
              const pct = avg != null ? (g.school === 'k12' ? avg : uvToPct(avg)) : null;
              return (
                <tr key={i}>
                  <td><input className="ge-rev-input ge-rev-wide" value={g.subject ?? ''} onChange={e => setField(i, 'subject', e.target.value)} /></td>
                  <td>
                    <select className="ge-rev-select" value={g.school ?? 'uv'} onChange={e => setField(i, 'school', e.target.value)}>
                      {SCHOOLS_OPT.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td><input className="ge-rev-input ge-rev-num" type="number" min="0.5" max="6" step="0.5" value={g.units ?? 3} onChange={e => setField(i, 'units', e.target.value)} /></td>
                  <td><input className="ge-rev-input ge-rev-num" type="number" step="0.01" value={g.prelim ?? ''} onChange={e => setField(i, 'prelim', e.target.value)} /></td>
                  <td><input className="ge-rev-input ge-rev-num" type="number" step="0.01" value={g.midterm ?? ''} onChange={e => setField(i, 'midterm', e.target.value)} /></td>
                  <td><input className="ge-rev-input ge-rev-num" type="number" step="0.01" value={g.final_grade ?? ''} onChange={e => setField(i, 'final_grade', e.target.value)} /></td>
                  <td style={{ fontFamily: 'var(--ngs-mono)', fontSize: 12, textAlign: 'right', color: 'var(--ngs-navy)' }}>{avg != null ? avg.toFixed(2) : '—'}</td>
                  <td style={{ fontFamily: 'var(--ngs-mono)', fontSize: 12, textAlign: 'right', color: 'var(--ngs-ink-soft)' }}>{pct != null ? `${pct.toFixed(1)}%` : '—'}</td>
                  <td><button className="ge-rev-del" type="button" onClick={() => removeRow(i)} title="Remove">×</button></td>
                </tr>
              );
            })}
          </tbody>
          {review.length > 1 && (() => {
            const computedRows = review.map(g => {
              const vals = [g.prelim, g.midterm, g.final_grade].map(v => parseFloat(v)).filter(v => !isNaN(v));
              return { ...g, avg: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null };
            });
            const valid = computedRows.filter(g => g.avg != null && parseFloat(g.units) > 0);
            const totalUnits = valid.reduce((s, g) => s + (parseFloat(g.units) || 0), 0);
            const wa = totalUnits ? valid.reduce((s, g) => s + g.avg * (parseFloat(g.units) || 0), 0) / totalUnits : null;
            const isK12 = valid.every(g => g.school === 'k12');
            const waPct = wa != null ? (isK12 ? wa : uvToPct(wa)) : null;
            if (wa == null) return null;
            return (
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ padding: '6px 4px', borderTop: '2px solid var(--ngs-rule)', fontWeight: 700, fontSize: 11.5, color: 'var(--ngs-navy)', fontFamily: 'var(--ngs-mono)', textAlign: 'right' }}>
                    Weighted Avg ({totalUnits} units)
                  </td>
                  <td style={{ padding: '6px 4px', borderTop: '2px solid var(--ngs-rule)', fontWeight: 700, fontSize: 12, color: 'var(--ngs-navy)', fontFamily: 'var(--ngs-mono)', textAlign: 'right' }}>
                    {wa.toFixed(2)}
                  </td>
                  <td style={{ padding: '6px 4px', borderTop: '2px solid var(--ngs-rule)', fontWeight: 700, fontSize: 12, color: 'var(--ngs-navy)', fontFamily: 'var(--ngs-mono)', textAlign: 'right' }}>
                    {waPct != null ? `${waPct.toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ borderTop: '2px solid var(--ngs-rule)' }} />
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>

      {(geminiLoading || geminiAnalysis) && (
        <div className="nai-gemini-analysis" style={{ margin: '10px 0' }}>
          <span className="nai-tier-badge nai-tier-2" style={{ marginBottom: 6, display: 'inline-block' }}>Gemini · Analysis</span>
          {geminiLoading
            ? <p className="nai-gemini-analysis-text" style={{ color: 'var(--ngs-muted)' }}>Gemini is reviewing the grades…</p>
            : <p className="nai-gemini-analysis-text">{geminiAnalysis}</p>
          }
        </div>
      )}

      {/* AI correction chat */}
      <div className="ge-rev-chat">
        {chatLog.length > 0 && (
          <div className="ge-rev-chat-log">
            {chatLog.map((m, i) => (
              <div key={i} className={`ge-rev-chat-msg ge-rev-chat-${m.role}`}>{m.text}</div>
            ))}
          </div>
        )}
        <form className="ge-rev-chat-form" onSubmit={handleChat}>
          <input
            className="ge-rev-chat-input"
            placeholder='Ask AI to fix anything, e.g. "change Anatomy final to 1.75"'
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            disabled={chatBusy}
          />
          <button type="submit" className="ge-rev-chat-send" disabled={!chatInput.trim() || chatBusy}>
            {chatBusy ? '…' : 'Fix →'}
          </button>
        </form>
      </div>

      {(error || chatError) && <div className="et-error">{error || chatError}</div>}

      <div className="ge-rev-actions">
        <button className="et-submit" onClick={onConfirm} disabled={loading || !review.length}>
          {loading ? 'Saving…' : 'Confirm & save'}
        </button>
        <button className="et-log-btn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}

// ── AI grade import ───────────────────────────────────────────────────────────

function AiGradeImport({ scholarKey, semKey, onSaved }) {
  const [open, setOpen]       = useState(false);
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [review, setReview]   = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);

  const readFile = (f) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res({ name: f.name, base64: reader.result.split(',')[1], mime: f.type });
    reader.onerror = rej;
    reader.readAsDataURL(f);
  });

  async function handleExtract(e) {
    e.preventDefault();
    if (!file || loading) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ask-scholar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
        body: JSON.stringify({ scholar: scholarKey, type: 'grade_ingest', sem: semKey, file: { base64: file.base64, mime: file.mime } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (!Array.isArray(json.grades) || json.grades.length === 0) throw new Error('No grade entries found in this document.');
      setReview(json.grades);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!review) return;
    setLoading(true); setError(null);
    try {
      const entries = review.map(g => {
        const p = g.prelim != null ? parseFloat(g.prelim) : null;
        const m = g.midterm != null ? parseFloat(g.midterm) : null;
        const f = g.final_grade != null ? parseFloat(g.final_grade) : null;
        const vals = [p, m, f].filter(v => v != null && !isNaN(v));
        const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
        return {
          scholar: scholarKey, sem: semKey, school: g.school || 'uv',
          subject: g.subject, units: parseFloat(g.units) || 3,
          prelim: isNaN(p) ? null : p, midterm: isNaN(m) ? null : m, final_grade: isNaN(f) ? null : f,
          period_avg: avg, pct_equiv: avg != null ? (g.school === 'k12' ? avg : uvToPct(avg)) : null,
        };
      });
      const { error: err } = await supabase.from('grade_entries').insert(entries);
      if (err) throw new Error(err.message);
      setSuccess(entries.length);
      setReview(null); setFile(null); setOpen(false);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button className="et-log-btn" style={{ background: 'rgba(201,168,76,0.10)', color: 'var(--ngs-gold)', border: '1px solid rgba(201,168,76,0.3)', marginBottom: 8 }}
        onClick={() => setOpen(true)}>
        AI import grade report
      </button>
    );
  }

  return (
    <div className="ge-ai-import">
      <div className="ge-ai-import-header">
        <span>AI grade import</span>
        <button type="button" className="et-form-close" onClick={() => { setOpen(false); setFile(null); setReview(null); setError(null); }}>×</button>
      </div>

      {!review ? (
        <form onSubmit={handleExtract}>
          <p className="ge-ai-import-hint">Upload a screenshot of your grade report. Gemini will extract all subjects automatically.</p>
          <input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; if (f && ACCEPTED_MIME.includes(f.type)) setFile(await readFile(f)); }} />
          <button type="button" className="et-log-btn" style={{ marginBottom: 8 }} onClick={() => fileInputRef.current?.click()}>
            {file ? file.name : 'Choose file…'}
          </button>
          {file && (
            <button type="submit" className="et-submit" disabled={loading}>
              {loading ? 'Extracting…' : 'Extract grades'}
            </button>
          )}
          {error && <div className="et-error">{error}</div>}
        </form>
      ) : (
        <ReviewPanel
          review={review}
          setReview={setReview}
          scholarKey={scholarKey}
          sem={semKey}
          loading={loading}
          error={error}
          onConfirm={handleConfirm}
          onBack={() => setReview(null)}
        />
      )}
      {success && <div className="ge-ai-success">✓ {success} subjects saved.</div>}
    </div>
  );
}

export function GradeEntry({ scholarKey }) {
  const config = CONFIGS[scholarKey] || CONFIGS.claire;
  const [semKey, setSemKey] = useState(config.semKey);
  const [rows, setRows] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => emptyForm(config.defaultSchool));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Keep semKey in sync with whatever the mentor last set
  useEffect(() => {
    supabase.from('scholars').select('current_sem').eq('scholar_key', scholarKey).limit(1)
      .then(({ data }) => { if (data?.[0]?.current_sem) setSemKey(data[0].current_sem); });
  }, [scholarKey]);

  useEffect(() => {
    supabase
      .from('grade_entries')
      .select('*')
      .eq('scholar', scholarKey)
      .order('sem')
      .order('created_at')
      .then(({ data }) => setRows(data ?? []));
  }, [scholarKey]);

  // live preview — ranges differ per school
  const isK12 = form.school === 'k12';
  const p = parseFloat(form.prelim), m = parseFloat(form.midterm), f = parseFloat(form.final_grade);
  const gradeMin = isK12 ? 0 : 1, gradeMax = isK12 ? 100 : 5;
  const allThree = [p, m, f].every(v => !isNaN(v) && v >= gradeMin && v <= gradeMax);
  const previewAvg = allThree ? Math.round(((p + m + f) / 3) * 10000) / 10000 : null;
  const previewPct = previewAvg != null
    ? (isK12 ? Math.round(previewAvg * 100) / 100 : uvToPct(previewAvg))
    : null;

  const semLabel = SEM_LABELS[semKey] || semLabel || semKey;
  const currentRows = (rows ?? []).filter(r => r.sem === semKey);
  const semIsK12 = currentRows.length > 0 && currentRows.every(r => r.school === 'k12');
  const currentGpa = weightedGpa(currentRows);
  const currentPct = currentGpa != null
    ? (semIsK12 ? Math.round(currentGpa * 100) / 100 : uvToPct(currentGpa))
    : null;
  const totalUnits = currentRows.reduce((s, r) => s + (r.units || 0), 0);

  const priorSems = [...new Set((rows ?? []).map(r => r.sem))]
    .filter(s => s !== semKey)
    .sort();

  async function handleSubmit(e) {
    e.preventDefault();
    const units = parseFloat(form.units);
    if (!form.subject.trim() || !units || !previewAvg) return;
    setSubmitting(true);
    setError(null);

    const entry = {
      scholar: scholarKey,
      sem: semKey,
      school: form.school,
      subject: form.subject.trim(),
      units,
      prelim: p || null,
      midterm: m || null,
      final_grade: f || null,
      period_avg: previewAvg,
      pct_equiv: previewPct,
    };
    const tempId = `temp-${Date.now()}`;
    setRows(prev => [...(prev ?? []), { ...entry, id: tempId }]);
    setShowForm(false);
    setForm(emptyForm(form.school));

    const { data, error: err } = await supabase
      .from('grade_entries').insert(entry).select().single();
    if (err) {
      setRows(prev => prev.filter(r => r.id !== tempId));
      setError('Could not save. Please try again.');
      setShowForm(true);
    } else {
      setRows(prev => prev.map(r => r.id === tempId ? data : r));
    }
    setSubmitting(false);
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="sp-page">
      <div className="sp">

        <header className="sp-head">
          <div className="sp-track">
            <span className="sp-track-dot" />
            NextGen Nurses
            <span className="sp-track-sep">·</span>
            NGN
          </div>
          <p className="sp-greet-kicker">{config.name}</p>
          <h1 className="sp-greet-name">Grades.</h1>
          <div className="sp-head-rule" />
          <div className="sp-head-meta">
            <span className="sp-stage">{semLabel}</span>
            <Link href={config.homeHref} className="sp-tagline" style={{ textDecoration: 'none' }}>
              ← Back to home
            </Link>
          </div>
        </header>

        <ScholarChatPanel
          scholarKey={scholarKey}
          ingestionLabel="Upload grade report"
          onGoToIngestion={() => document.getElementById('scholar-grade-ingest')?.scrollIntoView({ behavior: 'smooth' })}
        />

        {/* ── GPA card ── */}
        <section className="sp-section">
          <div className="ge-gpa-card">
            {rows === null ? (
              <div style={{ color: 'rgba(250,247,240,0.5)', fontFamily: 'var(--ngs-mono)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Loading…
              </div>
            ) : (
              <>
                <div className="ge-gpa-row">
                  <span className="ge-gpa-num">
                    {currentGpa != null
                      ? (semIsK12 ? `${currentGpa.toFixed(1)}%` : currentGpa.toFixed(2))
                      : '—'}
                  </span>
                  <div className="ge-gpa-meta">
                    <span className="ge-gpa-label">{semIsK12 ? 'Weighted Average' : 'Weighted GPA'}</span>
                    {!semIsK12 && currentPct !== null && <span className="ge-gpa-pct">{currentPct.toFixed(1)}%</span>}
                    {currentGpa != null && (
                      <span className="ge-gpa-desc">
                        {semIsK12 ? k12Desc(currentGpa) : uvDesc(currentGpa)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ge-gpa-footer">
                  {semLabel} · {currentRows.length} subject{currentRows.length !== 1 ? 's' : ''} · {totalUnits} units
                </div>
              </>
            )}
          </div>

          {error && <div className="et-error">{error}</div>}

          <AiGradeImport
              scholarKey={scholarKey}
              semKey={semKey}
              onSaved={() => {
                supabase.from('grade_entries').select('*').eq('scholar', scholarKey)
                  .order('sem').order('created_at')
                  .then(({ data }) => setRows(data ?? []));
              }}
            />

          {!showForm ? (
            <button className="et-log-btn" onClick={() => setShowForm(true)}>
              + Add subject
            </button>
          ) : (
            <form className="et-form" onSubmit={handleSubmit}>
              <div className="et-form-head">
                <span>New subject</span>
                <button type="button" className="et-form-close" onClick={() => { setShowForm(false); setError(null); }}>×</button>
              </div>

              <div className="et-field">
                <label>School / Scale</label>
                <select value={form.school} onChange={set('school')}>
                  {SCHOOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div className="et-field">
                <label>Subject name</label>
                <input type="text" placeholder="e.g. Anatomy & Physiology I"
                  value={form.subject} onChange={set('subject')} required />
              </div>

              <div className="et-field">
                <label>Units</label>
                <input type="number" min="1" max="6" step="0.5"
                  value={form.units} onChange={set('units')} required />
              </div>

              <div className="ge-grade-row">
                {['prelim', 'midterm', 'final_grade'].map((field, i) => (
                  <div className="et-field" key={field}>
                    <label>{['Prelim', 'Midterm', 'Final'][i]}</label>
                    <input type="number"
                      min={isK12 ? 0 : 1} max={isK12 ? 100 : 5} step="0.01"
                      placeholder={isK12 ? '0–100' : '1.00'}
                      value={form[field]} onChange={set(field)} />
                  </div>
                ))}
              </div>

              {previewAvg !== null && (
                <div className="ge-preview">
                  {!isK12 && <><span className="ge-preview-avg">Avg: {previewAvg.toFixed(2)}</span><span className="ge-preview-sep">·</span></>}
                  <span className="ge-preview-pct">{previewPct != null ? `${previewPct.toFixed(1)}%` : '—'}</span>
                  {previewPct != null && (
                    <>
                      <span className="ge-preview-sep">·</span>
                      <span className="ge-preview-desc">
                        {isK12 ? k12Desc(previewPct) : uvDesc(previewAvg)}
                      </span>
                    </>
                  )}
                </div>
              )}

              <button type="submit" className="et-submit"
                disabled={submitting || !previewAvg || !form.subject.trim()}>
                {submitting ? 'Saving…' : 'Save subject'}
              </button>
            </form>
          )}
        </section>

        {/* ── Current semester grades ── */}
        {rows !== null && currentRows.length > 0 && (
          <section className="sp-section ge-grades-section">
            <div className="sp-eyebrow">
              <span className="sp-eyebrow-rule" />
              {semLabel}
              <span className="sp-eyebrow-count">{String(currentRows.length).padStart(2, '0')}</span>
            </div>
            <div className="ge-table-wrap">
              <table className="ge-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th className="ge-n">Units</th>
                    <th className="ge-n">Prelim</th>
                    <th className="ge-n">Mid</th>
                    <th className="ge-n">Final</th>
                    <th className="ge-n">Avg</th>
                    <th className="ge-n">%</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRows.map(r => {
                    const isUv = r.school !== 'k12';
                    const gradeCell = (val) => val == null ? '—' : isUv ? (
                      <>{val}<span className="ge-grade-pct">{uvToPct(val) != null ? ` ${uvToPct(val).toFixed(0)}%` : ''}</span></>
                    ) : val;
                    return (
                      <tr key={r.id}>
                        <td className="ge-subject">{r.subject}</td>
                        <td className="ge-n">{r.units}</td>
                        <td className="ge-n ge-grade">{gradeCell(r.prelim)}</td>
                        <td className="ge-n ge-grade">{gradeCell(r.midterm)}</td>
                        <td className="ge-n ge-grade">{gradeCell(r.final_grade)}</td>
                        <td className="ge-n ge-avg">{r.period_avg?.toFixed(2) ?? '—'}</td>
                        <td className="ge-n ge-pct">{r.pct_equiv != null ? `${r.pct_equiv.toFixed(1)}%` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {currentRows.length > 1 && currentGpa != null && (
                  <tfoot>
                    <tr className="ge-total-row">
                      <td>Weighted {semIsK12 ? 'avg' : 'GPA'}</td>
                      <td className="ge-n">{totalUnits}</td>
                      <td colSpan={3} />
                      <td className="ge-n ge-avg">{currentGpa.toFixed(2)}</td>
                      <td className="ge-n ge-pct">
                        {semIsK12 ? `${currentGpa.toFixed(1)}%` : (currentPct != null ? `${currentPct.toFixed(1)}%` : '—')}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        )}

        {/* ── Prior semesters ── */}
        {priorSems.length > 0 && (
          <section className="sp-section ge-prior-section">
            <div className="sp-eyebrow">
              <span className="sp-eyebrow-rule" />
              Prior semesters
            </div>
            {priorSems.map(sem => (
              <PriorSem key={sem} sem={sem}
                rows={(rows ?? []).filter(r => r.sem === sem)} />
            ))}
          </section>
        )}

        <ScholarIngestPanel
          id="scholar-grade-ingest"
          type="grades"
          scholarKey={scholarKey}
          sem={semKey}
        />

        <footer className="sp-footer">
          <div className="sp-mark">NGS</div>
          <div className="sp-footer-tag">One generation lifts another.</div>
        </footer>
      </div>
    </div>
  );
}

function PriorSem({ sem, rows }) {
  const [open, setOpen] = useState(false);
  const gpa = weightedGpa(rows);
  const pct = gpa ? uvToPct(gpa) : null;

  return (
    <div className="ge-prior">
      <button className="ge-prior-btn" onClick={() => setOpen(o => !o)}>
        <span className="ge-prior-sem">{sem}</span>
        <span className="ge-prior-gpa">{gpa ? `GPA ${gpa.toFixed(2)}` : 'No data'}</span>
        {pct != null && <span className="ge-prior-pct">{pct.toFixed(1)}%</span>}
        <span className="ge-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && rows.length > 0 && (
        <div className="ge-prior-detail">
          <table className="ge-table ge-table-sm">
            <thead>
              <tr>
                <th>Subject</th>
                <th className="ge-n">Units</th>
                <th className="ge-n">Avg</th>
                <th className="ge-n">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const isUv = r.school !== 'k12';
                return (
                  <tr key={r.id}>
                    <td className="ge-subject">{r.subject}</td>
                    <td className="ge-n">{r.units}</td>
                    <td className="ge-n ge-avg">
                      {r.period_avg?.toFixed(2) ?? '—'}
                      {isUv && r.period_avg != null && uvToPct(r.period_avg) != null && (
                        <span className="ge-grade-pct"> {uvToPct(r.period_avg).toFixed(0)}%</span>
                      )}
                    </td>
                    <td className="ge-n ge-pct">{r.pct_equiv != null ? `${r.pct_equiv.toFixed(1)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
