import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const CONFIGS = {
  claire: { name: 'Claire', semKey: 'Y2S2', semLabel: 'Year 2 · Semester 2', homeHref: 'claire-home.html',
    semOrder: ['Y2S1', 'Y2S2', 'Y3S1', 'Y3S2'] },
  april:  { name: 'April',  semKey: 'TG11S1', semLabel: 'Grade 11 · Semester 1', homeHref: 'april-home.html',
    semOrder: ['TG11S1', 'TG11S2', 'TG12S1', 'TG12S2'] },
};

// UV grade scale — linear interpolation within each bracket
const UV_BRACKETS = [
  { min: 1.00, max: 1.09, minPct: 95.00, maxPct: 100.00, desc: 'Excellent' },
  { min: 1.10, max: 1.50, minPct: 90.00, maxPct: 94.99, desc: 'Superior' },
  { min: 1.60, max: 2.00, minPct: 85.00, maxPct: 89.99, desc: 'Very Good' },
  { min: 2.10, max: 2.50, minPct: 80.00, maxPct: 84.99, desc: 'Good' },
  { min: 2.60, max: 2.90, minPct: 76.00, maxPct: 79.99, desc: 'Fair' },
  { min: 3.00, max: 3.99, minPct: 75.00, maxPct: 75.99, desc: 'Pass' },
  { min: 5.00, max: 5.00, minPct:  0.00, maxPct:  0.00, desc: 'Failing' },
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

function weightedGpa(rows) {
  const valid = rows.filter(r => r.period_avg && r.units);
  if (!valid.length) return null;
  const totalUnits = valid.reduce((s, r) => s + (r.units || 0), 0);
  return totalUnits ? valid.reduce((s, r) => s + r.period_avg * r.units, 0) / totalUnits : null;
}

const emptyForm = () => ({ subject: '', units: '3', prelim: '', midterm: '', final_grade: '' });

export function GradeEntry({ scholarKey }) {
  const config = CONFIGS[scholarKey] || CONFIGS.claire;
  const [rows, setRows] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from('grade_entries')
      .select('*')
      .eq('scholar', scholarKey)
      .order('sem')
      .order('created_at')
      .then(({ data }) => setRows(data ?? []));
  }, [scholarKey]);

  // live preview
  const p = parseFloat(form.prelim), m = parseFloat(form.midterm), f = parseFloat(form.final_grade);
  const allThree = [p, m, f].every(v => !isNaN(v) && v >= 1 && v <= 5);
  const previewAvg = allThree ? Math.round(((p + m + f) / 3) * 10000) / 10000 : null;
  const previewPct = previewAvg ? uvToPct(previewAvg) : null;

  const currentRows = (rows ?? []).filter(r => r.sem === config.semKey);
  const currentGpa = weightedGpa(currentRows);
  const currentPct = currentGpa ? uvToPct(currentGpa) : null;
  const totalUnits = currentRows.reduce((s, r) => s + (r.units || 0), 0);

  const priorSems = (config.semOrder || [])
    .filter(s => s !== config.semKey)
    .filter(s => (rows ?? []).some(r => r.sem === s));

  async function handleSubmit(e) {
    e.preventDefault();
    const units = parseFloat(form.units);
    if (!form.subject.trim() || !units || !previewAvg) return;
    setSubmitting(true);
    setError(null);

    const entry = {
      scholar: scholarKey,
      sem: config.semKey,
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
    setForm(emptyForm());

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
            <span className="sp-stage">{config.semLabel}</span>
            <a href={config.homeHref} className="sp-tagline" style={{ textDecoration: 'none' }}>
              ← Back to home
            </a>
          </div>
        </header>

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
                  <span className="ge-gpa-num">{currentGpa ? currentGpa.toFixed(2) : '—'}</span>
                  <div className="ge-gpa-meta">
                    <span className="ge-gpa-label">Weighted GPA</span>
                    {currentPct !== null && <span className="ge-gpa-pct">{currentPct.toFixed(1)}%</span>}
                    {currentGpa && <span className="ge-gpa-desc">{uvDesc(currentGpa)}</span>}
                  </div>
                </div>
                <div className="ge-gpa-footer">
                  {config.semLabel} · {currentRows.length} subject{currentRows.length !== 1 ? 's' : ''} · {totalUnits} units
                </div>
              </>
            )}
          </div>

          {error && <div className="et-error">{error}</div>}

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
                <div className="et-field">
                  <label>Prelim</label>
                  <input type="number" min="1" max="5" step="0.01" placeholder="1.00"
                    value={form.prelim} onChange={set('prelim')} />
                </div>
                <div className="et-field">
                  <label>Midterm</label>
                  <input type="number" min="1" max="5" step="0.01" placeholder="1.00"
                    value={form.midterm} onChange={set('midterm')} />
                </div>
                <div className="et-field">
                  <label>Final</label>
                  <input type="number" min="1" max="5" step="0.01" placeholder="1.00"
                    value={form.final_grade} onChange={set('final_grade')} />
                </div>
              </div>

              {previewAvg !== null && (
                <div className="ge-preview">
                  <span className="ge-preview-avg">Avg: {previewAvg.toFixed(2)}</span>
                  <span className="ge-preview-sep">·</span>
                  <span className="ge-preview-pct">{previewPct !== null ? `${previewPct.toFixed(1)}%` : '—'}</span>
                  {previewPct !== null && (
                    <>
                      <span className="ge-preview-sep">·</span>
                      <span className="ge-preview-desc">{uvDesc(previewAvg)}</span>
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
              {config.semLabel}
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
                  {currentRows.map(r => (
                    <tr key={r.id}>
                      <td className="ge-subject">{r.subject}</td>
                      <td className="ge-n">{r.units}</td>
                      <td className="ge-n ge-grade">{r.prelim ?? '—'}</td>
                      <td className="ge-n ge-grade">{r.midterm ?? '—'}</td>
                      <td className="ge-n ge-grade">{r.final_grade ?? '—'}</td>
                      <td className="ge-n ge-avg">{r.period_avg?.toFixed(2) ?? '—'}</td>
                      <td className="ge-n ge-pct">{r.pct_equiv != null ? `${r.pct_equiv.toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                {currentRows.length > 1 && currentGpa != null && (
                  <tfoot>
                    <tr className="ge-total-row">
                      <td>Weighted GPA</td>
                      <td className="ge-n">{totalUnits}</td>
                      <td colSpan={4} />
                      <td className="ge-n ge-pct">{currentGpa.toFixed(2)}</td>
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
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="ge-subject">{r.subject}</td>
                  <td className="ge-n">{r.units}</td>
                  <td className="ge-n ge-avg">{r.period_avg?.toFixed(2) ?? '—'}</td>
                  <td className="ge-n ge-pct">{r.pct_equiv != null ? `${r.pct_equiv.toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
