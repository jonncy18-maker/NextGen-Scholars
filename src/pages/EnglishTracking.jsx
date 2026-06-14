import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SESSION_CATEGORIES, SESSION_TYPES } from '../constants.js';
import { EnglishIngestPanel } from '../components/EnglishIngestPanel.jsx';
import '../styles/english-tracking.css';

const FALLBACK = {
  claire: { name: 'Claire', semKey: 'Y2S2', homeHref: '/home/claire' },
  april:  { name: 'April',  semKey: 'TG11S1', homeHref: '/home/april' },
};

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtHours(totalMinutes) {
  const h = totalMinutes / 60;
  return h % 1 === 0 ? String(h) : h.toFixed(1);
}

function findActivePeriod(periods) {
  if (!periods?.length) return null;
  const t = today();
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

function getStatus(actual, expectedByToday) {
  if (!expectedByToday || expectedByToday === 0) return 'good';
  const ratio = actual / expectedByToday;
  if (ratio >= 0.9) return 'good';
  if (ratio >= 0.7) return 'warning';
  return 'risk';
}

function StatusChip({ status }) {
  const labels = { good: 'On Track', warning: 'Behind', risk: 'At Risk' };
  return <span className={`et-status-chip et-status-${status}`}>{labels[status]}</span>;
}

function sessionCategories(period) {
  if (!period) return SESSION_CATEGORIES.default;
  return SESSION_CATEGORIES[period.session_type] ?? SESSION_CATEGORIES.default;
}

// ── Weekly chart (kept from original) ─────────────────────────────────────────

function buildWeeklyData(sessions, numWeeks = 8) {
  const msDay  = 86400000, msWeek = 7 * msDay;
  const now    = new Date();
  const dow    = (now.getDay() + 6) % 7;
  const currentMon = new Date(now.getTime() - dow * msDay);
  currentMon.setHours(0, 0, 0, 0);

  const weeks = [];
  for (let i = numWeeks - 1; i >= 0; i--) {
    const ws = new Date(currentMon.getTime() - i * msWeek);
    const we = new Date(ws.getTime() + msWeek);
    const hrs = sessions
      .filter(s => { const d = new Date(s.date + 'T00:00:00'); return d >= ws && d < we; })
      .reduce((sum, s) => sum + (s.duration_minutes || 0) / 60, 0);
    weeks.push({ label: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), hrs, isCurrent: i === 0 });
  }
  return weeks;
}

function WeeklyChart({ sessions }) {
  const weeks = buildWeeklyData(sessions, 8);
  const max   = Math.max(...weeks.map(w => w.hrs), 0.5);
  return (
    <div className="et-weekly-chart">
      {weeks.map((w, i) => (
        <div key={i} className={`et-week-col${w.isCurrent ? ' et-week-current' : ''}`}>
          <div className="et-week-bar-wrap">
            <div className="et-week-bar" style={{ height: `${(w.hrs / max) * 100}%` }} />
          </div>
          {w.hrs > 0 && <span className="et-week-hrs">{w.hrs.toFixed(1)}</span>}
          <span className="et-week-label">{w.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Category bar chart ─────────────────────────────────────────────────────────

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

  const hasAnyGoal = cats.some(c => goals[c]);

  if (!hasAnyGoal) {
    return (
      <div className="et-cat-chart">
        {cats.map(cat => {
          const actual   = byCategory[cat] ?? 0;
          const actWidth = scale > 0 ? (actual / scale) * 100 : 0;
          return (
            <div key={cat} className="et-cat-bar-row">
              <span className="et-cat-bar-name">{cat}</span>
              <div className="et-cat-bar-tracks">
                <div className="et-cat-bar-track et-cat-bar-track--act">
                  <div className="et-cat-bar-fill et-cat-bar-fill--act" style={{ width: `${actWidth}%` }} />
                  <span className="et-cat-bar-val">{actual.toFixed(1)}h</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="et-cat-chart">
      {cats.map(cat => {
        const expected       = goals[cat] ?? null;
        const actual         = byCategory[cat] ?? 0;
        const expectedToday  = expected != null ? expected * elapsed : null;
        const status         = expectedToday != null ? getStatus(actual, expectedToday) : 'good';
        const expWidth       = expected != null ? (expected / scale) * 100 : 0;
        const actWidth       = (actual  / scale) * 100;

        return (
          <div key={cat} className="et-cat-bar-row">
            <div className="et-cat-bar-label">
              <span className="et-cat-bar-name">{cat}</span>
              {expectedToday != null && <StatusChip status={status} />}
            </div>
            <div className="et-cat-bar-tracks">
              {expected != null && (
                <div className="et-cat-bar-track et-cat-bar-track--exp">
                  <div className="et-cat-bar-fill et-cat-bar-fill--exp" style={{ width: `${expWidth}%` }} />
                  <span className="et-cat-bar-val">{expected}h expected</span>
                </div>
              )}
              <div className="et-cat-bar-track et-cat-bar-track--act">
                <div className={`et-cat-bar-fill et-cat-bar-fill--act et-cat-bar-fill--${status}`}
                  style={{ width: `${actWidth}%` }} />
                <span className="et-cat-bar-val">{actual.toFixed(1)}h actual</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Session row with inline edit ───────────────────────────────────────────────

function SessionRow({ sess, cats, onSaved, onDeleted }) {
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState(null);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    if (!mins || mins < 1) return;
    setSaving(true);
    const { error } = await supabase.from('english_sessions').update({
      date:             form.date,
      duration_minutes: mins,
      activity_type:    form.activity_type,
      notes:            form.notes || null,
    }).eq('id', sess.id);
    setSaving(false);
    if (!error) { setEditing(false); onSaved(); }
  }

  async function handleDelete() {
    if (!confirm('Delete this session?')) return;
    setDeleting(true);
    await supabase.from('english_sessions').delete().eq('id', sess.id);
    onDeleted(sess.id);
  }

  if (editing && form) {
    return (
      <div className="et-row et-row--editing">
        <div className="et-row-edit-fields">
          <input type="date" value={form.date} max={today()}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <input type="number" min="1" max="600" value={form.duration}
            onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
            style={{ width: 70 }} />
          <select value={form.activity_type}
            onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
          <input type="text" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="notes" style={{ flex: 1 }} />
        </div>
        <div className="et-row-edit-actions">
          <button className="et-edit-save" onClick={handleSave} disabled={saving}>{saving ? '…' : 'Save'}</button>
          <button className="et-edit-cancel" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="et-row">
      <div className="et-row-left">
        <span className="et-row-date">{fmtDate(sess.date)}</span>
        <span className="et-row-type">{sess.activity_type}</span>
        {sess.notes && <span className="et-row-notes">{sess.notes}</span>}
      </div>
      <div className="et-row-right">
        <span className="et-row-dur">{fmtDuration(sess.duration_minutes)}</span>
        <button className="et-row-edit" onClick={startEdit} title="Edit">✎</button>
        <button className="et-row-del" onClick={handleDelete} disabled={deleting} title="Delete">×</button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function EnglishTracking({ scholarKey }) {
  const fallback = FALLBACK[scholarKey] || FALLBACK.claire;

  const [period,      setPeriod]      = useState(undefined);
  const [sessions,    setSessions]    = useState(null);
  const [showForm,    setShowForm]    = useState(false);
  const [showIngest,  setShowIngest]  = useState(false);
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState(null);
  const [collapsedCats, setCollapsedCats] = useState(null); // initialized after period loads

  useEffect(() => {
    supabase
      .from('english_periods')
      .select('*')
      .eq('scholar', scholarKey)
      .order('start_date', { ascending: false })
      .then(({ data }) => setPeriod(findActivePeriod(data || [])));
  }, [scholarKey]);

  useEffect(() => {
    if (period === undefined) return;
    let q = supabase
      .from('english_sessions')
      .select('*')
      .eq('scholar', scholarKey)
      .order('date', { ascending: false });

    if (period) {
      q = q.gte('date', period.start_date).lte('date', period.end_date);
    } else {
      q = q.eq('sem', fallback.semKey);
    }
    q.then(({ data }) => {
      const rows = data ?? [];
      setSessions(rows);
      if (collapsedCats === null) {
        const cats = period ? (SESSION_CATEGORIES[period.session_type] ?? SESSION_CATEGORIES.default) : SESSION_CATEGORIES.default;
        setCollapsedCats(new Set(cats));
      }
    });
  }, [scholarKey, period, fallback.semKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function reloadSessions() {
    if (period === undefined) return;
    let q = supabase
      .from('english_sessions')
      .select('*')
      .eq('scholar', scholarKey)
      .order('date', { ascending: false });
    if (period) {
      q = q.gte('date', period.start_date).lte('date', period.end_date);
    } else {
      q = q.eq('sem', fallback.semKey);
    }
    q.then(({ data }) => setSessions(data ?? []));
  }

  const cats         = sessionCategories(period);
  const totalMinutes = sessions ? sessions.reduce((s, r) => s + (r.duration_minutes || 0), 0) : 0;
  const target       = period ? Number(period.hour_goal) : null;
  const pct          = target ? Math.min(100, (totalMinutes / 60 / target) * 100) : null;
  const elapsed      = period ? periodElapsedFraction(period.start_date, period.end_date) : 0;
  const expectedNow  = target ? target * elapsed : null;
  const overallStatus = getStatus(totalMinutes / 60, expectedNow ?? 0);

  const pace = (() => {
    if (!period || !sessions?.length) return null;
    const msWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksLeft = Math.max(0, (new Date(period.end_date + 'T00:00:00') - new Date()) / msWeek);
    const cutoff = new Date(Date.now() - 28 * 86400000);
    const recentMins = sessions.filter(s => new Date(s.date + 'T00:00:00') >= cutoff)
      .reduce((s, r) => s + (r.duration_minutes || 0), 0);
    const hrsPerWeek = recentMins / 60 / 4;
    const remaining  = Math.max(0, (target || 0) - totalMinutes / 60);
    const needed     = weeksLeft > 0.5 ? (remaining / weeksLeft).toFixed(1) : null;
    return { hrsPerWeek: hrsPerWeek.toFixed(1), weeksLeft: Math.ceil(weeksLeft), needed };
  })();

  const periodLabel = period
    ? `${period.label} · ${fmtDateShort(period.start_date)} – ${fmtDateShort(period.end_date)}`
    : fallback.semKey;

  const sessionTypeName = period
    ? (SESSION_TYPES.find(t => t.key === period.session_type)?.label ?? period.label)
    : null;

  function initForm() {
    setForm({ date: today(), duration: '', activity_type: cats[0] ?? 'Other', notes: '' });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const minutes = parseInt(form.duration, 10);
    if (!minutes || minutes < 1) return;

    setSubmitting(true);
    setError(null);

    const newSession = {
      scholar:          scholarKey,
      sem:              period?.label ?? fallback.semKey,
      date:             form.date,
      duration_minutes: minutes,
      activity_type:    form.activity_type,
      category:         'conversation',
      notes:            form.notes.trim() || null,
      period_id:        period?.id ?? null,
    };

    const { data, error: err } = await supabase
      .from('english_sessions').insert(newSession).select().single();

    if (err) {
      setError('Could not save. Please try again.');
    } else {
      setSessions(prev => [data, ...(prev ?? [])].sort((a, b) => b.date.localeCompare(a.date)));
      setShowForm(false);
      setForm(null);
    }
    setSubmitting(false);
  }

  function toggleCat(cat) {
    setCollapsedCats(prev => {
      const next = new Set(prev ?? []);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  // Group sessions by category
  const grouped = {};
  cats.forEach(c => { grouped[c] = []; });
  (sessions ?? []).forEach(s => {
    const c = cats.includes(s.activity_type) ? s.activity_type : 'Other';
    (grouped[c] ??= []).push(s);
  });

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
          <p className="sp-greet-kicker">{fallback.name}</p>
          <h1 className="sp-greet-name">English<br/>Hours.</h1>
          <div className="sp-head-rule" />
          <div className="sp-head-meta">
            <span className="sp-stage">{periodLabel}</span>
            <Link to={fallback.homeHref} className="sp-tagline" style={{ textDecoration: 'none' }}>
              ← Back to home
            </Link>
          </div>
        </header>

        <section className="sp-section">
          {/* Progress card */}
          <div className="et-progress-card">
            {sessions === null ? (
              <div style={{ color: 'rgba(250,247,240,0.5)', fontFamily: 'var(--ngs-mono)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Loading…
              </div>
            ) : (
              <>
                <div className="et-progress-top-row">
                  <div className="et-hours-row">
                    <span className="et-hours-big">{fmtHours(totalMinutes)}</span>
                    <span className="et-hours-unit">hrs</span>
                    {target && <span className="et-hours-target">/ {target}</span>}
                  </div>
                  {expectedNow != null && (
                    <StatusChip status={overallStatus} />
                  )}
                </div>

                {sessionTypeName && (
                  <div className="et-session-type-label">{sessionTypeName}</div>
                )}

                {pct !== null && (
                  <>
                    <div className="et-bar-track">
                      <div className="et-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="et-progress-meta">{pct.toFixed(0)}% of goal</div>
                  </>
                )}

                {pace && (
                  <div className="et-pace-row">
                    <span className="et-pace-stat">{pace.hrsPerWeek}h/wk pace</span>
                    {pace.needed && <span className="et-pace-needed">· need {pace.needed}h/wk</span>}
                    <span className="et-pace-weeks">· {pace.weeksLeft}w left</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Category bar chart */}
          {sessions !== null && period && (
            <CategoryBarChart period={period} sessions={sessions} />
          )}

          {/* 8-week chart */}
          {sessions !== null && sessions.length > 0 && (
            <WeeklyChart sessions={sessions} />
          )}

          {error && <div className="et-error">{error}</div>}

          {/* AI ingest + log session controls */}
          <div className="et-action-row">
            <button className="et-log-btn"
              style={{ flex: 1 }}
              onClick={() => { initForm(); setShowIngest(false); }}>
              + Log session
            </button>
            <button className="et-ai-btn"
              onClick={() => { setShowIngest(v => !v); setShowForm(false); }}>
              {showIngest ? 'Cancel' : 'AI · Paste summary'}
            </button>
          </div>

          {showIngest && (
            <EnglishIngestPanel
              scholarKey={scholarKey}
              categories={cats}
              periodId={period?.id ?? null}
              sem={period?.label ?? fallback.semKey}
              onSaved={() => { setShowIngest(false); reloadSessions(); }}
            />
          )}

          {showForm && form && (
            <form className="et-form" onSubmit={handleSubmit}>
              <div className="et-form-head">
                <span>New session</span>
                <button type="button" className="et-form-close"
                  onClick={() => { setShowForm(false); setForm(null); setError(null); }}>×</button>
              </div>

              <div className="et-field">
                <label>Date</label>
                <input type="date" value={form.date} max={today()}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>

              <div className="et-field">
                <label>Duration (minutes)</label>
                <input type="number" min="1" max="600" placeholder="e.g. 90"
                  value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} required />
              </div>

              <div className="et-field">
                <label>Category</label>
                <select value={form.activity_type}
                  onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}>
                  {cats.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="et-field">
                <label>Notes <span className="et-optional">(optional)</span></label>
                <textarea rows={2} placeholder="What did you practise?"
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <button type="submit" className="et-submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save session'}
              </button>
            </form>
          )}
        </section>

        {/* Session history grouped by category */}
        {sessions !== null && sessions.length > 0 && (
          <section className="sp-section et-history-section">
            <div className="sp-eyebrow">
              <span className="sp-eyebrow-rule" />
              Sessions
              <span className="sp-eyebrow-count">{sessions.length.toString().padStart(2, '0')}</span>
            </div>
            {Object.entries(grouped).map(([cat, rows]) => (
              <div key={cat} className="et-cat-group">
                <button className="et-cat-group-toggle" onClick={() => toggleCat(cat)}>
                  <span className="et-cat-group-name">{cat}</span>
                  <span className="et-cat-group-count">{rows.length} session{rows.length !== 1 ? 's' : ''}</span>
                  <span className="et-cat-group-hrs">
                    {rows.reduce((s, r) => s + (r.duration_minutes || 0) / 60, 0).toFixed(1)}h
                  </span>
                  <span className="et-cat-group-chevron">
                    {(collapsedCats?.has(cat)) ? '▶' : '▼'}
                  </span>
                </button>
                {!(collapsedCats?.has(cat)) && (
                  <div className="et-cat-group-rows">
                    {rows.length === 0 ? (
                      <div className="et-cat-group-empty">No sessions in this category yet.</div>
                    ) : (
                      rows.map(s => (
                        <SessionRow
                          key={s.id} sess={s} cats={cats}
                          onSaved={reloadSessions}
                          onDeleted={() => setSessions(prev => (prev ?? []).filter(r => r.id !== s.id))}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {sessions !== null && sessions.length === 0 && (
          <div className="et-empty">
            No sessions logged yet. Tap <em>Log session</em> to start.
          </div>
        )}

        <footer className="sp-footer">
          <div className="sp-mark">NGS</div>
          <div className="sp-footer-tag">One generation lifts another.</div>
        </footer>
      </div>
    </div>
  );
}
