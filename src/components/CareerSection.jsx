import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { useData } from '../context/DataContext.jsx';
import { NAMECLASS } from '../constants.js';

const STEPS = ['PNLE', 'OET', 'NCLEX', 'OSCE', 'AHPRA'];

const STEP_SUBTITLE = {
  PNLE:  'Phil. Nursing Licensure',
  OET:   'Occupational English',
  NCLEX: 'US Nursing Licensure',
  OSCE:  'Clinical Skills Exam',
  AHPRA: 'AU Registration',
};

const STATUS_META = {
  pending:     { label: 'Pending',     cls: 'cs-badge-pending',  icon: '○' },
  in_progress: { label: 'In Progress', cls: 'cs-badge-progress', icon: '◑' },
  passed:      { label: 'Passed',      cls: 'cs-badge-passed',   icon: '✓' },
  failed:      { label: 'Failed',      cls: 'cs-badge-failed',   icon: '✕' },
  waived:      { label: 'Waived',      cls: 'cs-badge-waived',   icon: '—' },
};

const STATUSES = Object.keys(STATUS_META);
const EMPTY_FORM = { status: 'pending', exam_date: '', score: '', notes: '' };

function fmt(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StepBlock({ step, row, onClick, active }) {
  const status = row?.status || 'pending';
  const { label, cls, icon } = STATUS_META[status];
  return (
    <button
      className={`cs-step${active ? ' cs-step-active' : ''} ${status === 'passed' ? 'cs-step-done' : ''}`}
      onClick={onClick}
      title={`${step} — click to edit`}
    >
      <span className="cs-step-icon">{icon}</span>
      <span className="cs-step-name">{step}</span>
      <span className="cs-step-sub">{STEP_SUBTITLE[step]}</span>
      <span className={`cs-step-badge ${cls}`}>{label}</span>
      {row?.exam_date && <span className="cs-step-date">{fmt(row.exam_date)}</span>}
      {row?.score     && <span className="cs-step-score">{row.score}</span>}
    </button>
  );
}

function StepEditor({ scholar, step, row, onSave, onCancel, saving, error }) {
  const [form, setForm] = useState({
    status:    row?.status    || 'pending',
    exam_date: row?.exam_date || '',
    score:     row?.score     || '',
    notes:     row?.notes     || '',
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <div className="cs-editor">
      <div className="cs-editor-header">
        <strong>{step}</strong>
        <span className="cs-editor-sub">{STEP_SUBTITLE[step]}</span>
      </div>
      <div className="cs-editor-fields">
        <label className="cs-field">
          <span>Status</span>
          <select value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </label>
        <label className="cs-field">
          <span>Exam date</span>
          <input type="date" value={form.exam_date} onChange={e => set('exam_date', e.target.value)} />
        </label>
        <label className="cs-field">
          <span>Score / result</span>
          <input type="text" placeholder="e.g. 87, Band 7.5" value={form.score} onChange={e => set('score', e.target.value)} />
        </label>
        <label className="cs-field cs-field-notes">
          <span>Notes</span>
          <input type="text" placeholder="Optional" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </label>
      </div>
      {error && <p className="cs-editor-error">{error}</p>}
      <div className="cs-editor-actions">
        <button className="cs-save-btn" onClick={() => onSave(form)} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="cs-cancel-btn" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}

function ScholarTrack({ sk, steps }) {
  const { D } = useData();
  const name  = D.scholars[sk]?.name || sk;
  const nc    = NAMECLASS[sk] || '';

  const [activeStep, setActiveStep] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState(null);

  function toggle(step) {
    setActiveStep(prev => (prev === step ? null : step));
    setSaveError(null);
  }

  async function handleSave(step, form) {
    setSaving(true);
    setSaveError(null);
    try {
      await api.put('/career', {
        scholar: sk,
        step,
        status:     form.status,
        exam_date:  form.exam_date || null,
        score:      form.score     || null,
        notes:      form.notes     || null,
      });
      setActiveStep(null);
    } catch (err) {
      setSaveError(err.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  const passed  = steps.filter(s => s.status === 'passed').length;
  const total   = STEPS.length;

  return (
    <div className="cs-scholar-card">
      <div className="cs-scholar-header">
        <span className={`cs-scholar-name ${nc}`}>{name}</span>
        <span className="cs-progress-chip">{passed}/{total} steps complete</span>
      </div>
      <div className="cs-pipeline">
        {STEPS.map((step, i) => {
          const row = steps.find(s => s.step === step);
          return (
            <React.Fragment key={step}>
              {i > 0 && (
                <span className={`cs-arrow${row?.status === 'passed' ? ' cs-arrow-done' : ''}`}>›</span>
              )}
              <StepBlock
                step={step}
                row={row}
                active={activeStep === step}
                onClick={() => toggle(step)}
              />
            </React.Fragment>
          );
        })}
      </div>
      {activeStep && (
        <StepEditor
          scholar={sk}
          step={activeStep}
          row={steps.find(s => s.step === activeStep)}
          onSave={form => handleSave(activeStep, form)}
          onCancel={() => { setActiveStep(null); setSaveError(null); }}
          saving={saving}
          error={saveError}
        />
      )}
    </div>
  );
}

export function CareerSection({ id, collapsed, onToggle }) {
  const { scholarKeys } = useData();

  const [rows, setRows]         = useState([]);
  const [loadError, setLoadError] = useState(null);

  async function load() {
    setLoadError(null);
    try {
      const data = await api.get('/career');
      setRows(data || []);
    } catch (err) {
      setLoadError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  // Inert until Phase B3 — see DocumentsSection.jsx's identical note.
  useEffect(() => {
    const ch = supabase.channel('ngs_career')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'career_steps' }, () => load())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const byScholar = sk => rows.filter(r => r.scholar === sk);

  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        Career Pathway
        <span className="eyebrow-rule" />
        <button className="section-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="cs-body">
          <div className="section-head">
            <h2 className="section-title">PNLE → OET → NCLEX → OSCE → AHPRA</h2>
            <span className="section-note">Click any step to edit</span>
          </div>

          {loadError && <p className="cs-load-error">Failed to load: {loadError}</p>}

          <div className="cs-tracks">
            {scholarKeys.map(sk => (
              <ScholarTrack key={sk} sk={sk} steps={byScholar(sk)} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
