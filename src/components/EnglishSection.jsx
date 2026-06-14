import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../context/DataContext.jsx';
import { supabase } from '../lib/supabase.js';
import { NAMECLASS, SESSION_TYPES, SESSION_CATEGORIES } from '../constants.js';
import { EnglishIngestPanel } from './EnglishIngestPanel.jsx';

function todayStr() { return new Date().toISOString().slice(0, 10); }

function fmtDur(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMonthYear(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function activePeriod(periods) {
  if (!periods?.length) return null;
  const t = todayStr();
  return periods.find(p => p.start_date <= t && p.end_date >= t)
    ?? periods.slice().sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
}

function periodElapsedFraction(startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00');
  const end   = new Date(endDate   + 'T00:00:00');
  const now   = new Date();
  const total = Math.max(1, (end - start) / 86400000);
  const elapsed = Math.min(total, Math.max(0, (now - start) / 86400000));
  return elapsed / total;
}

function getStatus(actual, expected) {
  if (!expected || expected === 0) return 'good';
  const ratio = actual / expected;
  if (ratio >= 0.9) return 'good';
  if (ratio >= 0.7) return 'warning';
  return 'risk';
}

function StatusBadge({ status }) {
  const labels = { good: 'On Track', warning: 'Slightly Behind', risk: 'At Risk' };
  return <span className={`enp-status-badge enp-status-${status}`}>{labels[status]}</span>;
}

function sessionCategories(period) {
  if (!period) return SESSION_CATEGORIES.default;
  return SESSION_CATEGORIES[period.session_type] ?? SESSION_CATEGORIES.default;
}

// ── Period form (add/edit) ─────────────────────────────────────────────────────

const EMPTY_PERIOD = { label: '', session_type: 'summer_bootcamp', start_date: '', end_date: '', hour_goal: 200 };

function PeriodForm({ scholar, initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_PERIOD, ...initial });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.label || !form.start_date || !form.end_date || !form.hour_goal) {
      setErr('All fields are required.'); return;
    }
    setSaving(true); setErr(null);
    try {
      const payload = {
        scholar,
        label:        form.label,
        session_type: form.session_type,
        start_date:   form.start_date,
        end_date:     form.end_date,
        hour_goal:    Number(form.hour_goal),
      };
      const { error } = initial?.id
        ? await supabase.from('english_periods').update(payload).eq('id', initial.id)
        : await supabase.from('english_periods').insert(payload);
      if (error) throw error;
      onSave();
    } catch (e) { setErr(e.message ?? 'Save failed.'); }
    finally { setSaving(false); }
  }

  const cats = SESSION_CATEGORIES[form.session_type] ?? SESSION_CATEGORIES.default;

  return (
    <div className="enp-form">
      <div className="enp-form-fields">
        <label className="enp-field">
          <span>Session type</span>
          <select value={form.session_type} onChange={e => set('session_type', e.target.value)}>
            {SESSION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
        <label className="enp-field">
          <span>Session name</span>
          <input type="text" placeholder="e.g. Summer Bootcamp 2026" value={form.label}
            onChange={e => set('label', e.target.value)} />
        </label>
        <label className="enp-field">
          <span>Start date</span>
          <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
        </label>
        <label className="enp-field">
          <span>End date</span>
          <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
        </label>
        <label className="enp-field">
          <span>Total hour goal</span>
          <input type="number" min="1" step="1" value={form.hour_goal}
            onChange={e => set('hour_goal', e.target.value)} style={{ width: 90 }} />
        </label>
      </div>
      <div className="enp-form-note">Categories for this session: {cats.join(', ')}</div>
      {err && <p className="enp-form-error">{err}</p>}
      <div className="enp-form-actions">
        <button className="enp-save-btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="enp-cancel-btn" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}

// ── Category goals form ─────────────────────────────────────────────────────────

function CategoryGoalsForm({ period, onSave, onCancel }) {
  const cats   = sessionCategories(period);
  const stored = period.category_goals ?? {};
  const [goals, setGoals] = useState(Object.fromEntries(cats.map(c => [c, stored[c] ?? ''])));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  async function handleSave() {
    setSaving(true); setErr(null);
    const cleaned = Object.fromEntries(
      Object.entries(goals).map(([k, v]) => [k, v === '' ? null : Number(v)])
    );
    const { error } = await supabase.from('english_periods')
      .update({ category_goals: cleaned }).eq('id', period.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSave();
  }

  return (
    <div className="enp-catgoals-form">
      <div className="enp-catgoals-title">Expected hours per category</div>
      <div className="enp-catgoals-fields">
        {cats.map(cat => (
          <label key={cat} className="enp-catgoals-field">
            <span>{cat}</span>
            <input type="number" min="0" step="0.5" placeholder="—"
              value={goals[cat] ?? ''} onChange={e => setGoals(g => ({ ...g, [cat]: e.target.value }))}
              style={{ width: 80 }} />
            <span className="enp-catgoals-unit">hrs</span>
          </label>
        ))}
      </div>
      {err && <p className="enp-form-error">{err}</p>}
      <div className="enp-form-actions">
        <button className="enp-save-btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="enp-cancel-btn" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}

// ── Add session form ───────────────────────────────────────────────────────────

function AddSessionForm({ scholar, period, onSave, onCancel }) {
  const cats = sessionCategories(period);
  const [form, setForm] = useState({
    date: todayStr(), duration: '', activity_type: cats[0] ?? 'Other', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    const mins = parseInt(form.duration, 10);
    if (!mins || mins < 1) { setErr('Enter a valid duration.'); return; }
    if (!form.date) { setErr('Date required.'); return; }
    setSaving(true); setErr(null);
    try {
      const { error } = await supabase.from('english_sessions').insert({
        scholar,
        date:             form.date,
        duration_minutes: mins,
        activity_type:    form.activity_type,
        category:         'conversation',
        notes:            form.notes || null,
        sem:              period?.label ?? null,
        period_id:        period?.id ?? null,
      });
      if (error) throw error;
      onSave();
    } catch (e) { setErr(e.message ?? 'Save failed.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="enp-form">
      <div className="enp-form-fields">
        <label className="enp-field">
          <span>Date</span>
          <input type="date" value={form.date} max={todayStr()} onChange={e => set('date', e.target.value)} />
        </label>
        <label className="enp-field">
          <span>Duration (min)</span>
          <input type="number" min="1" max="600" placeholder="90"
            value={form.duration} onChange={e => set('duration', e.target.value)} style={{ width: 90 }} />
        </label>
        <label className="enp-field">
          <span>Category</span>
          <select value={form.activity_type} onChange={e => set('activity_type', e.target.value)}>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="enp-field enp-field-wide">
          <span>Notes (optional)</span>
          <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </label>
      </div>
      {err && <p className="enp-form-error">{err}</p>}
      <div className="enp-form-actions">
        <button className="enp-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Add session'}
        </button>
        <button className="enp-cancel-btn" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}

// ── Session row (with inline edit) ─────────────────────────────────────────────

function SessionRow({ sess, period, onSaved, onDeleted }) {
  const cats = sessionCategories(period);
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState(null);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr]           = useState(null);

  function startEdit() {
    setForm({
      date:          sess.date,
      duration:      String(sess.duration_minutes),
      activity_type: sess.activity_type,
      notes:         sess.notes ?? '',
    });
    setEditing(true);
  }

  async function handleSave() {
    const mins = parseInt(form.duration, 10);
    if (!mins || mins < 1) { setErr('Enter a valid duration.'); return; }
    setSaving(true); setErr(null);
    const { error } = await supabase.from('english_sessions').update({
      date:             form.date,
      duration_minutes: mins,
      activity_type:    form.activity_type,
      notes:            form.notes || null,
    }).eq('id', sess.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setEditing(false);
    onSaved();
  }

  async function handleDelete() {
    if (!confirm('Delete this session?')) return;
    setDeleting(true);
    await supabase.from('english_sessions').delete().eq('id', sess.id);
    onDeleted(sess.id);
  }

  if (editing && form) {
    return (
      <div className="enp-sess-row enp-sess-row--editing">
        <div className="enp-sess-edit-fields">
          <input type="date" value={form.date} max={todayStr()}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <input type="number" min="1" max="600" value={form.duration}
            onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
            style={{ width: 70 }} placeholder="mins" />
          <select value={form.activity_type}
            onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
          <input type="text" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="notes" style={{ flex: 1 }} />
        </div>
        {err && <span className="enp-sess-edit-err">{err}</span>}
        <div className="enp-sess-edit-actions">
          <button className="enp-save-btn" style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={handleSave} disabled={saving}>{saving ? '…' : 'Save'}</button>
          <button className="enp-cancel-btn" style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={() => { setEditing(false); setErr(null); }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="enp-sess-row">
      <span className="enp-sess-date">{fmtDate(sess.date)}</span>
      <span className="enp-sess-type">{sess.activity_type}</span>
      {sess.notes && <span className="enp-sess-notes">{sess.notes}</span>}
      <span className="enp-sess-dur">{fmtDur(sess.duration_minutes)}</span>
      <button className="enp-sess-edit-btn" onClick={startEdit}>Edit</button>
      <button className="enp-sess-del" onClick={handleDelete} disabled={deleting}>×</button>
    </div>
  );
}

// ── Category bar chart ──────────────────────────────────────────────────────────

function CategoryBarChart({ period, sessions }) {
  const cats    = sessionCategories(period);
  const goals   = period?.category_goals ?? {};
  const elapsed = period ? periodElapsedFraction(period.start_date, period.end_date) : 0;

  const byCategory = {};
  cats.forEach(c => { byCategory[c] = 0; });
  sessions.forEach(s => {
    if (cats.includes(s.activity_type)) {
      byCategory[s.activity_type] = (byCategory[s.activity_type] || 0) + (s.duration_minutes || 0) / 60;
    }
  });

  const maxExpected = Math.max(...cats.map(c => goals[c] ?? 0), 1);
  const maxActual   = Math.max(...Object.values(byCategory), 0.1);
  const scale       = Math.max(maxExpected, maxActual);

  return (
    <div className="enp-cat-bars">
      {cats.map(cat => {
        const expected       = goals[cat] ?? null;
        const actual         = byCategory[cat] ?? 0;
        const expectedToday  = expected != null ? expected * elapsed : null;
        const status         = expectedToday != null ? getStatus(actual, expectedToday) : 'good';
        const expWidth       = expected != null ? (expected / scale) * 100 : 0;
        const actWidth       = (actual  / scale) * 100;

        return (
          <div key={cat} className="enp-cat-bar-row">
            <div className="enp-cat-bar-label">
              <span className="enp-cat-bar-name">{cat}</span>
              {expected != null && (
                <StatusBadge status={status} />
              )}
            </div>
            <div className="enp-cat-bar-tracks">
              {expected != null && (
                <div className="enp-cat-bar-track enp-cat-bar-track--exp">
                  <div className="enp-cat-bar-fill enp-cat-bar-fill--exp" style={{ width: `${expWidth}%` }} />
                  <span className="enp-cat-bar-val">{expected}h expected</span>
                </div>
              )}
              <div className="enp-cat-bar-track enp-cat-bar-track--act">
                <div className={`enp-cat-bar-fill enp-cat-bar-fill--act enp-cat-bar-fill--${status}`}
                  style={{ width: `${actWidth}%` }} />
                <span className="enp-cat-bar-val">{actual.toFixed(1)}h actual</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Scholar detail view (mentor clicks into a scholar) ─────────────────────────

function ScholarEnglishDetail({ sk, periods, sessions, onBack, onRefresh }) {
  const { D } = useData();
  const name = D.scholars[sk]?.name || sk;
  const nc   = NAMECLASS[sk] || '';

  const active   = activePeriod(periods);
  const filtered = active
    ? sessions.filter(s => s.date >= active.start_date && s.date <= active.end_date)
    : sessions;

  const cats = sessionCategories(active);

  const totalHours = filtered.reduce((s, r) => s + (r.duration_minutes || 0) / 60, 0);
  const elapsed    = active ? periodElapsedFraction(active.start_date, active.end_date) : 0;
  const goal       = active ? Number(active.hour_goal) : null;
  const pct        = goal ? Math.min(100, (totalHours / goal) * 100) : null;
  const expectedByToday = goal ? goal * elapsed : null;
  const overallStatus   = getStatus(totalHours, expectedByToday ?? 0);

  const [showPeriodForm,   setShowPeriodForm]   = useState(false);
  const [editingPeriod,    setEditingPeriod]     = useState(null);
  const [showCatGoals,     setShowCatGoals]      = useState(false);
  const [showAddSession,   setShowAddSession]    = useState(false);
  const [showIngest,       setShowIngest]        = useState(false);
  const [collapsedCats,    setCollapsedCats]     = useState(new Set(cats));

  function toggleCat(cat) {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  async function deletePeriod(p) {
    if (!confirm(`Delete session "${p.label}"?`)) return;
    await supabase.from('english_periods').delete().eq('id', p.id);
    onRefresh();
  }

  const grouped = {};
  cats.forEach(c => { grouped[c] = []; });
  filtered.forEach(s => {
    const c = cats.includes(s.activity_type) ? s.activity_type : 'Other';
    (grouped[c] ??= []).push(s);
  });

  const sessionType = active ? (SESSION_TYPES.find(t => t.key === active.session_type)?.label ?? active.session_type) : null;
  const durationStr = active
    ? `${fmtMonthYear(active.start_date)} – ${fmtMonthYear(active.end_date)}`
    : null;

  return (
    <div className="enp-detail">
      <div className="enp-detail-header">
        <button className="enp-back-btn" onClick={onBack}>← All scholars</button>
        <h3 className={`enp-detail-name ${nc}`}>{name}</h3>
      </div>

      {/* Session info bar */}
      {active && (
        <div className="enp-session-bar">
          <div className="enp-session-meta">
            <span className="enp-session-type-label">{sessionType}</span>
            {durationStr && <span className="enp-session-dur-label">{durationStr}</span>}
            {active.start_date && (
              <span className="enp-session-year">{new Date(active.start_date + 'T00:00:00').getFullYear()}</span>
            )}
          </div>
          <div className="enp-session-actions">
            <button className="enp-catgoals-btn"
              onClick={() => setShowCatGoals(v => !v)}>
              {Object.keys(active.category_goals ?? {}).length ? 'Edit expected hours' : 'Add expected hours'}
            </button>
            <button className="enp-period-edit-btn"
              onClick={() => { setEditingPeriod(active); setShowPeriodForm(true); }}>
              Edit session
            </button>
          </div>
        </div>
      )}

      {!active && (
        <div className="enp-no-period">
          No active session — add one to start tracking.
          <button className="enp-add-period-btn" style={{ marginLeft: 12 }}
            onClick={() => { setEditingPeriod(null); setShowPeriodForm(true); }}>
            + New session
          </button>
        </div>
      )}

      {showPeriodForm && (
        <PeriodForm
          scholar={sk}
          initial={editingPeriod}
          onSave={() => { setShowPeriodForm(false); setEditingPeriod(null); onRefresh(); }}
          onCancel={() => { setShowPeriodForm(false); setEditingPeriod(null); }}
        />
      )}

      {showCatGoals && active && (
        <CategoryGoalsForm
          period={active}
          onSave={() => { setShowCatGoals(false); onRefresh(); }}
          onCancel={() => setShowCatGoals(false)}
        />
      )}

      {/* Progress overview */}
      {goal != null && (
        <div className="enp-progress">
          <div className="enp-progress-top">
            <span className="enp-hrs-stat">{totalHours.toFixed(1)} / {goal}h</span>
            <span className="enp-pct-stat">{pct?.toFixed(0)}%</span>
            <StatusBadge status={overallStatus} />
          </div>
          <div className="enp-bar-track">
            <div className="enp-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Category bar chart */}
      {active && (
        <CategoryBarChart period={active} sessions={filtered} />
      )}

      {/* AI ingest + add session controls */}
      <div className="enp-add-row">
        <button className="enp-add-sess-btn"
          onClick={() => { setShowAddSession(v => !v); setShowIngest(false); }}>
          {showAddSession ? 'Cancel' : '+ Add session'}
        </button>
        <button className="enp-ingest-btn"
          onClick={() => { setShowIngest(v => !v); setShowAddSession(false); }}>
          {showIngest ? 'Cancel' : 'AI · Paste summary'}
        </button>
      </div>

      {showAddSession && (
        <AddSessionForm
          scholar={sk} period={active}
          onSave={() => { setShowAddSession(false); onRefresh(); }}
          onCancel={() => setShowAddSession(false)}
        />
      )}

      {showIngest && (
        <EnglishIngestPanel
          scholarKey={sk}
          categories={cats}
          periodId={active?.id ?? null}
          sem={active?.label ?? null}
          onSaved={() => { setShowIngest(false); onRefresh(); }}
        />
      )}

      {/* Sessions grouped by category */}
      <div className="enp-cat-groups">
        {Object.entries(grouped).map(([cat, rows]) => (
          <div key={cat} className="enp-cat-group">
            <button className="enp-cat-group-toggle" onClick={() => toggleCat(cat)}>
              <span className="enp-cat-group-name">{cat}</span>
              <span className="enp-cat-group-count">{rows.length} session{rows.length !== 1 ? 's' : ''}</span>
              <span className="enp-cat-group-hrs">
                {rows.reduce((s, r) => s + (r.duration_minutes || 0) / 60, 0).toFixed(1)}h
              </span>
              <span className="enp-cat-group-chevron">{collapsedCats.has(cat) ? '▶' : '▼'}</span>
            </button>
            {!collapsedCats.has(cat) && rows.length > 0 && (
              <div className="enp-cat-group-rows">
                {rows.map(sess => (
                  <SessionRow
                    key={sess.id} sess={sess} period={active}
                    onSaved={onRefresh}
                    onDeleted={() => onRefresh()}
                  />
                ))}
              </div>
            )}
            {!collapsedCats.has(cat) && rows.length === 0 && (
              <div className="enp-cat-group-empty">No sessions logged yet.</div>
            )}
          </div>
        ))}
      </div>

      {/* Past periods */}
      {periods.length > 1 && (
        <div className="enp-past-periods">
          <div className="enp-past-heading">All sessions</div>
          {periods.map(p => (
            <div key={p.id} className={`enp-period-chip${active?.id === p.id ? ' enp-period-active' : ''}`}>
              <span className="enp-period-label">{p.label}</span>
              <span className="enp-period-dates">{fmtDate(p.start_date)} – {fmtDate(p.end_date)}</span>
              <span className="enp-period-goal">{p.hour_goal}h</span>
              <button className="enp-period-edit-btn"
                onClick={() => { setEditingPeriod(p); setShowPeriodForm(true); }}>Edit</button>
              <button className="enp-period-del-btn" onClick={() => deletePeriod(p)}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Overview cards ─────────────────────────────────────────────────────────────

function ScholarOverviewCard({ sk, periods, sessions, onSelect }) {
  const { D } = useData();
  const name  = D.scholars[sk]?.firstName || sk;
  const nc    = NAMECLASS[sk] || '';

  const active   = activePeriod(periods);
  const filtered = active
    ? sessions.filter(s => s.date >= active.start_date && s.date <= active.end_date)
    : sessions;

  const totalHours = filtered.reduce((s, r) => s + (r.duration_minutes || 0) / 60, 0);
  const goal       = active ? Number(active.hour_goal) : null;
  const pct        = goal ? Math.min(100, (totalHours / goal) * 100) : null;
  const elapsed    = active ? periodElapsedFraction(active.start_date, active.end_date) : 0;
  const expected   = goal ? goal * elapsed : null;
  const status     = getStatus(totalHours, expected ?? 0);

  const sessionLabel = active
    ? (SESSION_TYPES.find(t => t.key === active.session_type)?.label ?? active.label)
    : null;

  return (
    <div className={`enp-overview-card enp-overview-card--${status}`} onClick={() => onSelect(sk)}>
      <div className="enp-ov-header">
        <span className={`enp-ov-name ${nc}`}>{name}</span>
        <StatusBadge status={status} />
      </div>
      {sessionLabel && (
        <div className="enp-ov-session">{sessionLabel}</div>
      )}
      <div className="enp-ov-stats">
        <span className="enp-ov-hours">{totalHours.toFixed(1)}h</span>
        {goal && <span className="enp-ov-goal">/ {goal}h</span>}
      </div>
      {pct != null && (
        <div className="enp-ov-bar-track">
          <div className={`enp-ov-bar-fill enp-ov-bar-fill--${status}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="enp-ov-pct">{pct != null ? `${pct.toFixed(0)}%` : 'No session set'}</div>
      <div className="enp-ov-cta">View details →</div>
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────────────────────

export function EnglishSection({ id, collapsed, onToggle }) {
  const { scholarKeys } = useData();
  const [periods,  setPeriods]  = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null); // null = overview, else sk

  const load = useCallback(async () => {
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('english_periods').select('*').order('start_date', { ascending: false }),
      supabase.from('english_sessions').select('*').order('date', { ascending: false }),
    ]);
    setPeriods(p || []);
    setSessions(s || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="section" id={id}>
      <div className="eyebrow">
        English
        <span className="eyebrow-rule" />
        <button className="section-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="enp-body">
          {selected === null ? (
            <>
              <div className="section-head">
                <h2 className="section-title">English Hours Dashboard</h2>
                <span className="section-note">Click a scholar to view and manage their sessions</span>
              </div>
              <div className="enp-overview-grid">
                {scholarKeys.map(sk => (
                  <ScholarOverviewCard
                    key={sk} sk={sk}
                    periods={periods.filter(p => p.scholar === sk)}
                    sessions={sessions.filter(s => s.scholar === sk)}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            </>
          ) : (
            <ScholarEnglishDetail
              sk={selected}
              periods={periods.filter(p => p.scholar === selected)}
              sessions={sessions.filter(s => s.scholar === selected)}
              onBack={() => setSelected(null)}
              onRefresh={load}
            />
          )}
        </div>
      )}
    </section>
  );
}
