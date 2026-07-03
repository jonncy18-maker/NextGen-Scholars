import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../context/DataContext.jsx';
import { supabase } from '../lib/supabase.js';
import { NAMECLASS, SEMESTER_OPTIONS } from '../constants.js';
import { uvToPct } from '../screens/GradeEntry.jsx';

const SCHOOLS = [
  { value: 'uv',  label: 'UV (1.0–5.0)' },
  { value: 'k12', label: 'K-12 (%)' },
];

function weightedGpa(rows) {
  const valid = rows.filter(r => r.period_avg != null && r.units);
  if (!valid.length) return null;
  const total = valid.reduce((s, r) => s + (r.units || 0), 0);
  return total ? valid.reduce((s, r) => s + r.period_avg * r.units, 0) / total : null;
}

function recalc(school, prelim, midterm, final_grade) {
  const vals = [prelim, midterm, final_grade]
    .map(v => parseFloat(v))
    .filter(v => !isNaN(v));
  if (!vals.length) return { period_avg: null, pct_equiv: null };
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  return {
    period_avg: Math.round(avg * 10000) / 10000,
    pct_equiv:  school === 'k12' ? Math.round(avg * 100) / 100 : uvToPct(avg),
  };
}

// ── Inline-editable grade row ─────────────────────────────────────────────────

function GradeRow({ row, onSaved, onDeleted }) {
  const [editing,  setEditing]  = useState(false);
  const [form,     setForm]     = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  function startEdit() {
    setForm({
      subject:     row.subject,
      units:       String(row.units),
      school:      row.school || 'uv',
      prelim:      row.prelim      != null ? String(row.prelim)      : '',
      midterm:     row.midterm     != null ? String(row.midterm)     : '',
      final_grade: row.final_grade != null ? String(row.final_grade) : '',
    });
    setEditing(true);
  }

  function cancelEdit() { setEditing(false); setForm(null); }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    setSaving(true);
    const { period_avg, pct_equiv } = recalc(form.school, form.prelim, form.midterm, form.final_grade);
    const payload = {
      subject:     form.subject.trim() || row.subject,
      units:       parseFloat(form.units) || row.units,
      school:      form.school,
      prelim:      form.prelim      !== '' ? parseFloat(form.prelim)      : null,
      midterm:     form.midterm     !== '' ? parseFloat(form.midterm)     : null,
      final_grade: form.final_grade !== '' ? parseFloat(form.final_grade) : null,
      period_avg, pct_equiv,
    };
    const { error } = await supabase.from('grade_entries').update(payload).eq('id', row.id);
    setSaving(false);
    if (!error) { setEditing(false); setForm(null); onSaved({ ...row, ...payload }); }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${row.subject}"?`)) return;
    setDeleting(true);
    await supabase.from('grade_entries').delete().eq('id', row.id);
    onDeleted(row.id);
  }

  if (!editing) {
    const isUv = row.school !== 'k12';
    const gradeCell = (val) => val == null ? '—' : isUv ? (
      <>{val}{uvToPct(val) != null && <span className="gr-grade-pct"> {uvToPct(val).toFixed(0)}%</span>}</>
    ) : val;
    return (
      <tr>
        <td className="gr-subject">{row.subject}</td>
        <td className="gr-n gr-scale">{row.school === 'k12' ? 'K-12' : 'UV'}</td>
        <td className="gr-n">{row.units}</td>
        <td className="gr-n gr-grade">{gradeCell(row.prelim)}</td>
        <td className="gr-n gr-grade">{gradeCell(row.midterm)}</td>
        <td className="gr-n gr-grade">{gradeCell(row.final_grade)}</td>
        <td className="gr-n gr-avg">{row.period_avg?.toFixed(2) ?? '—'}</td>
        <td className="gr-n gr-pct">{row.pct_equiv != null ? `${row.pct_equiv.toFixed(1)}%` : '—'}</td>
        <td className="gr-n gr-row-actions">
          <button className="gr-row-edit" onClick={startEdit}>Edit</button>
          <button className="gr-row-del"  onClick={handleDelete} disabled={deleting}>×</button>
        </td>
      </tr>
    );
  }

  const isK12 = form.school === 'k12';
  const preview = recalc(form.school, form.prelim, form.midterm, form.final_grade);

  return (
    <tr className="gr-editing-row">
      <td><input className="gr-input" value={form.subject} onChange={e => set('subject', e.target.value)} /></td>
      <td>
        <select className="gr-select" value={form.school} onChange={e => set('school', e.target.value)}>
          {SCHOOLS.map(s => <option key={s.value} value={s.value}>{s.value.toUpperCase()}</option>)}
        </select>
      </td>
      <td>
        <input className="gr-input gr-input-sm" type="number" min="0.5" max="6" step="0.5"
          value={form.units} onChange={e => set('units', e.target.value)} />
      </td>
      {['prelim', 'midterm', 'final_grade'].map(field => (
        <td key={field}>
          <input className="gr-input gr-input-sm" type="number"
            min={isK12 ? 0 : 1} max={isK12 ? 100 : 5} step="0.01"
            value={form[field]} onChange={e => set(field, e.target.value)} />
        </td>
      ))}
      <td className="gr-n gr-avg">{preview.period_avg?.toFixed(2) ?? '—'}</td>
      <td className="gr-n gr-pct">{preview.pct_equiv != null ? `${preview.pct_equiv.toFixed(1)}%` : '—'}</td>
      <td className="gr-n gr-row-actions">
        <button className="gr-row-save" onClick={handleSave} disabled={saving}>{saving ? '…' : 'Save'}</button>
        <button className="gr-row-cancel" onClick={cancelEdit}>Cancel</button>
      </td>
    </tr>
  );
}

// ── Sem block ─────────────────────────────────────────────────────────────────

function SemBlock({ sk, sem, rows, onRowSaved, onRowDeleted, onAdded, onSemDeleted }) {
  const [open,     setOpen]     = useState(false);
  const [adding,   setAdding]   = useState(false);
  const [form,     setForm]     = useState({ subject: '', units: '3', school: 'uv', prelim: '', midterm: '', final_grade: '' });
  const [saving,   setSaving]   = useState(false);
  const [delSem,   setDelSem]   = useState(false);
  const [err,      setErr]      = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isK12 = form.school === 'k12';
  const preview = recalc(form.school, form.prelim, form.midterm, form.final_grade);

  const gpa        = weightedGpa(rows);
  const totalUnits = rows.reduce((s, r) => s + (r.units || 0), 0);
  const isK12Sem   = rows.length > 0 && rows.every(r => r.school === 'k12');

  async function handleDeleteSem() {
    if (!confirm(`Delete all ${rows.length} subject${rows.length !== 1 ? 's' : ''} in "${sem}"?`)) return;
    setDelSem(true);
    await supabase.from('grade_entries').delete().eq('scholar', sk).eq('sem', sem);
    onSemDeleted(sem);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.subject.trim()) { setErr('Subject name required.'); return; }
    setSaving(true); setErr(null);
    const entry = {
      scholar: sk, sem,
      subject: form.subject.trim(),
      units: parseFloat(form.units) || 3,
      school: form.school,
      prelim:      form.prelim      !== '' ? parseFloat(form.prelim)      : null,
      midterm:     form.midterm     !== '' ? parseFloat(form.midterm)     : null,
      final_grade: form.final_grade !== '' ? parseFloat(form.final_grade) : null,
      ...preview,
    };
    const { data, error } = await supabase.from('grade_entries').insert(entry).select().single();
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onAdded(data);
    setAdding(false);
    setForm({ subject: '', units: '3', school: 'uv', prelim: '', midterm: '', final_grade: '' });
  }

  return (
    <div className="gr-sem-block">
      <button className="gr-sem-header" onClick={() => setOpen(o => !o)}>
        <span className="gr-sem-chevron">{open ? '▾' : '▸'}</span>
        <span className="gr-sem-label">{sem}</span>
        {gpa != null && (
          <>
            <span className="gr-sem-gpa">{isK12Sem ? `${gpa.toFixed(1)}%` : `GPA ${gpa.toFixed(2)}`}</span>
            {!isK12Sem && uvToPct(gpa) != null && (
              <span className="gr-sem-pct">({uvToPct(gpa).toFixed(1)}%)</span>
            )}
          </>
        )}
        <span className="gr-sem-meta">{totalUnits} units · {rows.length} subj</span>
        <span className="gr-sem-actions" onClick={e => e.stopPropagation()}>
          <button className="gr-add-btn" onClick={() => { setOpen(true); setAdding(a => !a); }}>
            {adding ? 'Cancel' : '+ Add'}
          </button>
          {rows.length > 0 && (
            <button className="gr-del-sem-btn" onClick={handleDeleteSem} disabled={delSem} title={`Delete all of ${sem}`}>
              Delete sem
            </button>
          )}
        </span>
      </button>

      {open && rows.length > 0 && (
        <div className="gr-table-wrap">
          <table className="gr-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Scale</th>
                <th className="gr-n">Units</th>
                <th className="gr-n">Prelim</th>
                <th className="gr-n">Mid</th>
                <th className="gr-n">Final</th>
                <th className="gr-n">Avg</th>
                <th className="gr-n">%</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <GradeRow key={r.id} row={r} onSaved={onRowSaved} onDeleted={onRowDeleted} />
              ))}
            </tbody>
            {rows.length > 1 && gpa != null && (
              <tfoot>
                <tr className="gr-total-row">
                  <td colSpan={2}>Weighted {isK12Sem ? 'avg' : 'GPA'}</td>
                  <td className="gr-n">{totalUnits}</td>
                  <td colSpan={3} />
                  <td className="gr-n gr-avg">{gpa.toFixed(2)}</td>
                  <td className="gr-n gr-pct">
                    {isK12Sem ? `${gpa.toFixed(1)}%` : (uvToPct(gpa) != null ? `${uvToPct(gpa).toFixed(1)}%` : '—')}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {open && adding && (
        <form className="gr-add-form" onSubmit={handleAdd}>
          <div className="gr-add-fields">
            <label className="gr-field gr-field-wide">
              <span>Subject</span>
              <input type="text" value={form.subject} onChange={e => set('subject', e.target.value)}
                placeholder="e.g. Anatomy & Physiology I" required />
            </label>
            <label className="gr-field">
              <span>Scale</span>
              <select value={form.school} onChange={e => set('school', e.target.value)}>
                {SCHOOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="gr-field">
              <span>Units</span>
              <input type="number" min="0.5" max="6" step="0.5" value={form.units}
                onChange={e => set('units', e.target.value)} style={{ width: 70 }} />
            </label>
            {['prelim', 'midterm', 'final_grade'].map((field, i) => (
              <label className="gr-field" key={field}>
                <span>{['Prelim', 'Midterm', 'Final'][i]}</span>
                <input type="number" step="0.01"
                  min={isK12 ? 0 : 1} max={isK12 ? 100 : 5}
                  value={form[field]} onChange={e => set(field, e.target.value)}
                  style={{ width: 80 }} />
              </label>
            ))}
          </div>
          {preview.period_avg != null && (
            <div className="gr-add-preview">
              Avg: {preview.period_avg.toFixed(2)} · {preview.pct_equiv?.toFixed(1)}%
            </div>
          )}
          {err && <p className="gr-add-err">{err}</p>}
          <div className="gr-add-actions">
            <button type="submit" className="gr-row-save" disabled={saving}>{saving ? 'Saving…' : 'Save subject'}</button>
            <button type="button" className="gr-row-cancel" onClick={() => { setAdding(false); setErr(null); }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Scholar block ─────────────────────────────────────────────────────────────

function ScholarGradeBlock({ sk, allRows }) {
  const { D } = useData();
  const nc   = NAMECLASS[sk] || '';
  const name = D.scholars[sk]?.name || sk;

  const [rows, setRows]       = useState(allRows);
  const [addSem, setAddSem]   = useState(false);
  const [newSem, setNewSem]   = useState(SEMESTER_OPTIONS[0]);

  useEffect(() => setRows(allRows), [allRows]);

  // Group rows by sem — most recent sem first
  const sems = [...new Set(rows.map(r => r.sem))].sort((a, b) => b.localeCompare(a));

  function handleRowSaved(updated) {
    setRows(prev => prev.map(r => r.id === updated.id ? updated : r));
  }
  function handleRowDeleted(id) {
    setRows(prev => prev.filter(r => r.id !== id));
  }
  function handleAdded(entry) {
    setRows(prev => [...prev, entry]);
  }
  function handleSemDeleted(sem) {
    setRows(prev => prev.filter(r => r.sem !== sem));
  }

  // Quick stat: all-time weighted GPA across all sems
  const allGpa = weightedGpa(rows.filter(r => r.school === 'uv'));

  return (
    <div className="gr-scholar-block">
      <div className="gr-scholar-header">
        <span className={`gr-scholar-name ${nc}`}>{name}</span>
        <span className="gr-scholar-meta">
          {rows.length} subjects · {sems.length} sem{sems.length !== 1 ? 's' : ''}
          {allGpa != null && ` · overall GPA ${allGpa.toFixed(2)}`}
        </span>
        <button className="gr-add-btn" onClick={() => setAddSem(a => !a)}>
          {addSem ? 'Cancel' : '+ New sem entry'}
        </button>
      </div>

      {/* Quick-add to a specific sem (no existing block for it yet) */}
      {addSem && (
        <div className="gr-new-sem-row">
          <label className="gr-field">
            <span>Semester</span>
            <select value={newSem} onChange={e => setNewSem(e.target.value)}>
              {SEMESTER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <span className="gr-new-sem-hint">↓ Use "+ Add" in the sem block below, or pick a new sem here to open a form.</span>
        </div>
      )}

      {/* If adding to a new sem not yet in rows, show its block */}
      {addSem && !sems.includes(newSem) && (
        <SemBlock
          sk={sk} sem={newSem} rows={[]}
          onRowSaved={handleRowSaved}
          onRowDeleted={handleRowDeleted}
          onAdded={entry => { handleAdded(entry); setAddSem(false); }}
        />
      )}

      {sems.map(sem => (
        <SemBlock
          key={sem} sk={sk} sem={sem}
          rows={rows.filter(r => r.sem === sem)}
          onRowSaved={handleRowSaved}
          onRowDeleted={handleRowDeleted}
          onAdded={handleAdded}
          onSemDeleted={handleSemDeleted}
        />
      ))}

      {rows.length === 0 && !addSem && (
        <div className="gr-empty">No grade entries yet. Use + New sem entry to add.</div>
      )}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function GradesSection({ id, collapsed, onToggle }) {
  const { scholarKeys } = useData();
  const [allRows, setAllRows] = useState([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('grade_entries')
      .select('*')
      .order('scholar')
      .order('sem')
      .order('created_at');
    setAllRows(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        Grades
        <span className="eyebrow-rule" />
        <button className="section-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="gr-body">
          <div className="section-head">
            <h2 className="section-title">Grade records</h2>
            <span className="section-note">Click Edit on any row to update grades · × to delete</span>
          </div>

          <div className="gr-scholars">
            {scholarKeys.map(sk => (
              <ScholarGradeBlock
                key={sk}
                sk={sk}
                allRows={allRows.filter(r => r.scholar === sk)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
