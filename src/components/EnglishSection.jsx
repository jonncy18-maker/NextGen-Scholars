import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../context/DataContext.jsx';
import { supabase } from '../lib/supabase.js';
import { NAMECLASS } from '../constants.js';

const ACTIVITY_TYPES = ['OET Practice', 'Speaking', 'Listening', 'Reading', 'Writing', 'Other'];

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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateFull(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Period whose date range contains today, or else the most recent one
function activePeriod(periods) {
  if (!periods?.length) return null;
  const today = todayStr();
  return periods.find(p => p.start_date <= today && p.end_date >= today)
    ?? periods.slice().sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
}

function computeStats(sessions, period) {
  const total = sessions.reduce((s, r) => s + (r.duration_minutes || 0), 0) / 60;
  if (!period) return { total, goal: null, pct: null, weeksLeft: null, needed: null, pace: null };

  const goal = Number(period.hour_goal);
  const pct  = Math.min(100, (total / goal) * 100);

  const today   = new Date();
  const end     = new Date(period.end_date + 'T00:00:00');
  const msWeek  = 7 * 24 * 60 * 60 * 1000;
  const weeksLeft = Math.max(0, (end - today) / msWeek);

  const cutoff = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);
  const recentMins = sessions
    .filter(s => new Date(s.date + 'T00:00:00') >= cutoff)
    .reduce((s, r) => s + (r.duration_minutes || 0), 0);
  const pace = recentMins / 60 / 4;

  const remaining = Math.max(0, goal - total);
  const needed    = weeksLeft > 0.5 ? remaining / weeksLeft : null;

  return { total, goal, pct, weeksLeft: Math.ceil(weeksLeft), needed, pace };
}

function activityBreakdown(sessions) {
  const map = {};
  sessions.forEach(s => {
    const t = s.activity_type || 'Other';
    map[t] = (map[t] || 0) + (s.duration_minutes || 0) / 60;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([type, hrs]) => ({ type, hrs }));
}

// ── Period form ────────────────────────────────────────────────────────────────

const EMPTY_PERIOD = { label: '', start_date: '', end_date: '', hour_goal: 200 };

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
        scholar, label: form.label,
        start_date: form.start_date, end_date: form.end_date,
        hour_goal: Number(form.hour_goal),
      };
      const { error } = initial?.id
        ? await supabase.from('english_periods').update(payload).eq('id', initial.id)
        : await supabase.from('english_periods').insert(payload);
      if (error) throw error;
      onSave();
    } catch (e) { setErr(e.message ?? 'Save failed.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="enp-form">
      <div className="enp-form-fields">
        <label className="enp-field">
          <span>Label</span>
          <input type="text" placeholder="e.g. Y2S2" value={form.label} onChange={e => set('label', e.target.value)} />
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
          <span>Hour goal</span>
          <input type="number" min="1" step="1" value={form.hour_goal}
            onChange={e => set('hour_goal', e.target.value)} style={{ width: 90 }} />
        </label>
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

function AddSessionForm({ scholar, semLabel, onSave, onCancel }) {
  const [form, setForm] = useState({
    date: todayStr(), duration: '', activity_type: 'OET Practice', category: 'input', notes: '',
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
        scholar, sem: semLabel || null, date: form.date,
        duration_minutes: mins, activity_type: form.activity_type,
        category: form.category, notes: form.notes || null,
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
          <span>Activity</span>
          <select value={form.activity_type} onChange={e => set('activity_type', e.target.value)}>
            {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="enp-field">
          <span>Type</span>
          <div className="enp-cat-pick">
            {[['conversation', 'Conversation'], ['input', 'Input']].map(([val, lbl]) => (
              <button key={val} type="button"
                className={`enp-cat-btn${form.category === val ? ' is-active' : ''}`}
                onClick={() => set('category', val)}>
                {lbl}
              </button>
            ))}
          </div>
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

// ── Per-scholar block ──────────────────────────────────────────────────────────

function ScholarEnglishBlock({ sk, periods, sessions, onRefresh }) {
  const { D } = useData();
  const nc = NAMECLASS[sk] || '';
  const name = D.scholars[sk]?.name || sk;

  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [editingPeriod,  setEditingPeriod]  = useState(null);
  const [showAddSession, setShowAddSession]  = useState(false);
  const [deleting,       setDeleting]        = useState(null);

  const active   = activePeriod(periods);
  const filtered = active
    ? sessions.filter(s => s.date >= active.start_date && s.date <= active.end_date)
    : sessions;
  const stats     = computeStats(filtered, active);
  const breakdown = activityBreakdown(filtered);
  const maxHrs    = breakdown[0]?.hrs || 1;

  async function deletePeriod(p) {
    if (!confirm(`Delete period "${p.label}"?`)) return;
    await supabase.from('english_periods').delete().eq('id', p.id);
    onRefresh();
  }

  async function deleteSession(sess) {
    setDeleting(sess.id);
    await supabase.from('english_sessions').delete().eq('id', sess.id);
    onRefresh();
    setDeleting(null);
  }

  return (
    <div className="enp-scholar-block">
      {/* Header */}
      <div className="enp-scholar-header">
        <span className={`enp-scholar-name ${nc}`}>{name}</span>
        <span className="enp-total-chip">
          {stats.total.toFixed(1)}h
          {stats.goal ? ` / ${stats.goal}h goal` : ' logged'}
        </span>
      </div>

      {/* Periods */}
      <div className="enp-period-row">
        {periods.length === 0 && !showPeriodForm && (
          <span className="enp-no-period">No period set — add one to enable goal tracking</span>
        )}
        {periods.map(p => (
          <div key={p.id} className={`enp-period-chip${active?.id === p.id ? ' enp-period-active' : ''}`}>
            <span className="enp-period-label">{p.label}</span>
            <span className="enp-period-dates">{fmtDateFull(p.start_date)} – {fmtDateFull(p.end_date)}</span>
            <span className="enp-period-goal">{p.hour_goal}h</span>
            <button className="enp-period-edit-btn" onClick={() => { setEditingPeriod(p); setShowPeriodForm(true); }}>Edit</button>
            <button className="enp-period-del-btn" onClick={() => deletePeriod(p)}>×</button>
          </div>
        ))}
        {!showPeriodForm && (
          <button className="enp-add-period-btn" onClick={() => { setEditingPeriod(null); setShowPeriodForm(true); }}>
            + Period
          </button>
        )}
      </div>

      {showPeriodForm && (
        <PeriodForm
          scholar={sk}
          initial={editingPeriod}
          onSave={() => { setShowPeriodForm(false); setEditingPeriod(null); onRefresh(); }}
          onCancel={() => { setShowPeriodForm(false); setEditingPeriod(null); }}
        />
      )}

      {/* Progress bar */}
      {stats.goal != null && (
        <div className="enp-progress">
          <div className="enp-bar-track">
            <div className="enp-bar-fill" style={{ width: `${stats.pct}%` }} />
          </div>
          <div className="enp-progress-stats">
            <span className="enp-hrs-stat">{stats.total.toFixed(1)} / {stats.goal}h</span>
            <span className="enp-pct-stat">{stats.pct.toFixed(0)}%</span>
            <span className="enp-pace-stat">
              {stats.weeksLeft > 0
                ? `${stats.weeksLeft}w left · need ${stats.needed?.toFixed(1) ?? '—'}h/wk · pace ${stats.pace.toFixed(1)}h/wk`
                : 'Period complete'}
            </span>
          </div>
        </div>
      )}

      {/* Activity breakdown */}
      {breakdown.length > 0 && (
        <div className="enp-breakdown">
          <div className="enp-breakdown-heading">By activity</div>
          {breakdown.map(({ type, hrs }) => (
            <div key={type} className="enp-breakdown-row">
              <span className="enp-breakdown-type">{type}</span>
              <div className="enp-breakdown-track">
                <div className="enp-breakdown-bar" style={{ width: `${(hrs / maxHrs) * 100}%` }} />
              </div>
              <span className="enp-breakdown-hrs">{hrs.toFixed(1)}h</span>
            </div>
          ))}
        </div>
      )}

      {/* Sessions */}
      <div className="enp-sessions">
        <div className="enp-sessions-head">
          <span className="enp-sessions-label">
            Sessions{active ? ` · ${active.label}` : ''} ({filtered.length})
          </span>
          {!showAddSession && (
            <button className="enp-add-sess-btn" onClick={() => setShowAddSession(true)}>+ Add</button>
          )}
        </div>

        {showAddSession && (
          <AddSessionForm
            scholar={sk}
            semLabel={active?.label}
            onSave={() => { setShowAddSession(false); onRefresh(); }}
            onCancel={() => setShowAddSession(false)}
          />
        )}

        <div className="enp-session-list">
          {filtered.slice(0, 30).map(sess => (
            <div key={sess.id} className="enp-session-row">
              <span className="enp-sess-date">{fmtDate(sess.date)}</span>
              <span className="enp-sess-type">{sess.activity_type}</span>
              <span className={`enp-sess-cat enp-cat-${sess.category || 'input'}`}>
                {sess.category || 'input'}
              </span>
              {sess.notes && <span className="enp-sess-notes">{sess.notes}</span>}
              <span className="enp-sess-dur">{fmtDur(sess.duration_minutes)}</span>
              <button className="enp-sess-del" onClick={() => deleteSession(sess)}
                disabled={deleting === sess.id}>×</button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="enp-sessions-empty">No sessions in this period yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────────────────────

export function EnglishSection({ id, collapsed, onToggle }) {
  const { scholarKeys } = useData();
  const [periods,  setPeriods]  = useState([]);
  const [sessions, setSessions] = useState([]);

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
          <div className="section-head">
            <h2 className="section-title">English hours &amp; OET progress</h2>
            <span className="section-note">+ Period to define goals · + Add to log sessions</span>
          </div>
          <div className="enp-scholars">
            {scholarKeys.map(sk => (
              <ScholarEnglishBlock
                key={sk} sk={sk}
                periods={periods.filter(p => p.scholar === sk)}
                sessions={sessions.filter(s => s.scholar === sk)}
                onRefresh={load}
              />
            ))}
          </div>

        </div>
      )}
    </section>
  );
}
