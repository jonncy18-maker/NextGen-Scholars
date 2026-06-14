import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

// Hardcoded fallback configs — used only when no period exists in english_periods table
const FALLBACK = {
  claire: { name: 'Claire', semKey: 'Y2S2', semLabel: 'Year 2 · Semester 2', target: 200, homeHref: '/home/claire' },
  april:  { name: 'April',  semKey: 'TG11S1', semLabel: 'Grade 11 · Semester 1', target: null, homeHref: '/home/april' },
};

const ACTIVITY_TYPES = ['OET Practice', 'Speaking', 'Listening', 'Reading', 'Writing', 'Other'];

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtMonth(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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

// Find the active period — today in range, else most recent
function findActivePeriod(periods) {
  if (!periods?.length) return null;
  const t = today();
  return periods.find(p => p.start_date <= t && p.end_date >= t)
    ?? periods.slice().sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
}

// Weekly streak — consecutive weeks (Mon–Sun) with at least one session, going back from current week
function computeStreak(sessions) {
  if (!sessions.length) return 0;
  const msDay  = 24 * 60 * 60 * 1000;
  const msWeek = 7 * msDay;
  const now    = new Date();
  // Roll back to Monday of current week
  const dow    = (now.getDay() + 6) % 7;
  const weekStart = new Date(now.getTime() - dow * msDay);
  weekStart.setHours(0, 0, 0, 0);

  let streak = 0;
  let ws = new Date(weekStart);
  while (true) {
    const we = new Date(ws.getTime() + msWeek);
    const hasSession = sessions.some(s => {
      const d = new Date(s.date + 'T00:00:00');
      return d >= ws && d < we;
    });
    if (!hasSession) break;
    streak++;
    ws = new Date(ws.getTime() - msWeek);
  }
  return streak;
}

// Last N calendar weeks — each week Mon–Sun
function buildWeeklyData(sessions, numWeeks = 8) {
  const msDay  = 24 * 60 * 60 * 1000;
  const msWeek = 7 * msDay;
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

export function EnglishTracking({ scholarKey }) {
  const fallback = FALLBACK[scholarKey] || FALLBACK.claire;

  const [period,   setPeriod]   = useState(null);   // active english_period row (or null = fallback)
  const [sessions, setSessions] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: today(), duration: '', activity_type: ACTIVITY_TYPES[0], category: 'input', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Load active period from english_periods
  useEffect(() => {
    supabase
      .from('english_periods')
      .select('*')
      .eq('scholar', scholarKey)
      .order('start_date', { ascending: false })
      .then(({ data }) => setPeriod(findActivePeriod(data || [])));
  }, [scholarKey]);

  // Load sessions — filter by period date range if available, else by sem
  useEffect(() => {
    if (period === undefined) return; // still loading period
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
  }, [scholarKey, period, fallback.semKey]);

  // Derived stats
  const totalMinutes = sessions ? sessions.reduce((s, r) => s + (r.duration_minutes || 0), 0) : 0;
  const convMinutes  = sessions ? sessions.filter(s => s.category === 'conversation').reduce((s, r) => s + (r.duration_minutes || 0), 0) : 0;
  const inputMinutes = totalMinutes - convMinutes;
  const target       = period ? Number(period.hour_goal) : fallback.target;
  const pct          = target ? Math.min(100, (totalMinutes / 60 / target) * 100) : null;
  const streak       = sessions ? computeStreak(sessions) : 0;

  // Pace using period end date
  const pace = (() => {
    if (!period || !sessions?.length) return null;
    const msWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksLeft = Math.max(0, (new Date(period.end_date + 'T00:00:00') - new Date()) / msWeek);
    const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const recentMins = sessions.filter(s => new Date(s.date + 'T00:00:00') >= cutoff)
      .reduce((s, r) => s + (r.duration_minutes || 0), 0);
    const hrsPerWeek = recentMins / 60 / 4;
    const remaining  = Math.max(0, (target || 0) - totalMinutes / 60);
    const needed     = weeksLeft > 0.5 ? (remaining / weeksLeft).toFixed(1) : null;
    return { hrsPerWeek: hrsPerWeek.toFixed(1), weeksLeft: Math.ceil(weeksLeft), needed };
  })();

  const periodLabel = period
    ? `${period.label} · ${fmtDateShort(period.start_date)} – ${fmtDateShort(period.end_date)}`
    : fallback.semLabel;

  async function handleSubmit(e) {
    e.preventDefault();
    const minutes = parseInt(form.duration, 10);
    if (!minutes || minutes < 1) return;

    setSubmitting(true);
    setError(null);

    const tempId = `temp-${Date.now()}`;
    const newSession = {
      scholar: scholarKey,
      sem: period?.label ?? fallback.semKey,
      date: form.date,
      duration_minutes: minutes,
      activity_type: form.activity_type,
      category: form.category,
      notes: form.notes.trim() || null,
    };

    setSessions(prev => [...[{ ...newSession, id: tempId }], ...(prev ?? [])].sort((a, b) => b.date.localeCompare(a.date)));
    setShowForm(false);
    setForm({ date: today(), duration: '', activity_type: ACTIVITY_TYPES[0], category: 'input', notes: '' });

    const { data, error: err } = await supabase
      .from('english_sessions').insert(newSession).select().single();

    if (err) {
      setSessions(prev => prev.filter(s => s.id !== tempId));
      setError('Could not save. Please try again.');
      setShowForm(true);
    } else {
      setSessions(prev => prev.map(s => s.id === tempId ? data : s));
    }
    setSubmitting(false);
  }

  async function handleDelete(sess) {
    if (!confirm('Delete this session?')) return;
    setDeletingId(sess.id);
    const { error: err } = await supabase.from('english_sessions').delete().eq('id', sess.id);
    if (!err) setSessions(prev => prev.filter(s => s.id !== sess.id));
    setDeletingId(null);
  }

  // Group sessions by month
  const grouped = (sessions ?? []).reduce((acc, s) => {
    const m = fmtMonth(s.date);
    if (!acc[m]) acc[m] = [];
    acc[m].push(s);
    return acc;
  }, {});

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
          <div className="et-progress-card">
            {sessions === null ? (
              <div style={{ color: 'rgba(250,247,240,0.5)', fontFamily: 'var(--ngs-mono)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Loading…
              </div>
            ) : (
              <>
                <div className="et-hours-row">
                  <span className="et-hours-big">{fmtHours(totalMinutes)}</span>
                  <span className="et-hours-unit">hrs</span>
                  {target && <span className="et-hours-target">/ {target}</span>}
                </div>

                {pct !== null && (
                  <>
                    <div className="et-bar-track">
                      <div className="et-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="et-progress-meta">{pct.toFixed(0)}% of goal</div>
                  </>
                )}

                {/* Pace info when period is set */}
                {pace && (
                  <div className="et-pace-row">
                    <span className="et-pace-stat">{pace.hrsPerWeek}h/wk pace</span>
                    {pace.needed && <span className="et-pace-needed">· need {pace.needed}h/wk</span>}
                    <span className="et-pace-weeks">· {pace.weeksLeft}w left</span>
                  </div>
                )}

                <div className="et-cat-breakdown">
                  <div className="et-cat-stat">
                    <span className="et-cat-val">{fmtHours(convMinutes)}</span>
                    <span className="et-cat-label">Conversation</span>
                  </div>
                  <div className="et-cat-divider" />
                  <div className="et-cat-stat">
                    <span className="et-cat-val">{fmtHours(inputMinutes)}</span>
                    <span className="et-cat-label">Input</span>
                  </div>
                  <div className="et-cat-divider" />
                  <div className="et-cat-stat">
                    <span className="et-cat-val">{streak}</span>
                    <span className="et-cat-label">Week streak</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 8-week chart */}
          {sessions !== null && sessions.length > 0 && (
            <WeeklyChart sessions={sessions} />
          )}

          {error && <div className="et-error">{error}</div>}

          {!showForm ? (
            <button className="et-log-btn" onClick={() => setShowForm(true)}>+ Log session</button>
          ) : (
            <form className="et-form" onSubmit={handleSubmit}>
              <div className="et-form-head">
                <span>New session</span>
                <button type="button" className="et-form-close" onClick={() => { setShowForm(false); setError(null); }}>×</button>
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
                <label>Type</label>
                <div className="et-cat-pick">
                  {[['conversation', 'Conversation'], ['input', 'Input']].map(([val, lbl]) => (
                    <button key={val} type="button"
                      className={`et-cat-btn${form.category === val ? ' is-active' : ''}`}
                      onClick={() => setForm(f => ({ ...f, category: val }))}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="et-field">
                <label>Activity</label>
                <select value={form.activity_type} onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}>
                  {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="et-field">
                <label>Notes <span className="et-optional">(optional)</span></label>
                <textarea rows={3} placeholder="What did you practise?"
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <button type="submit" className="et-submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save session'}
              </button>
            </form>
          )}
        </section>

        {sessions !== null && sessions.length > 0 && (
          <section className="sp-section et-history-section">
            <div className="sp-eyebrow">
              <span className="sp-eyebrow-rule" />
              History
              <span className="sp-eyebrow-count">{sessions.length.toString().padStart(2, '0')}</span>
            </div>
            {Object.entries(grouped).map(([month, rows]) => (
              <div key={month} className="et-month-group">
                <div className="et-month-label">{month}</div>
                {rows.map(s => (
                  <div key={s.id} className="et-row">
                    <div className="et-row-left">
                      <span className="et-row-date">{fmtDate(s.date)}</span>
                      <span className="et-row-type">{s.activity_type}</span>
                      {s.notes && <span className="et-row-notes">{s.notes}</span>}
                    </div>
                    <div className="et-row-right">
                      <span className="et-row-dur">{fmtDuration(s.duration_minutes)}</span>
                      <button
                        className="et-row-del"
                        onClick={() => handleDelete(s)}
                        disabled={deletingId === s.id}
                        title="Delete session"
                      >×</button>
                    </div>
                  </div>
                ))}
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
