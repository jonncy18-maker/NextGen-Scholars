import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const CONFIGS = {
  claire: { name: 'Claire', semKey: 'Y2S2', semLabel: 'Year 2 · Semester 2', target: 200, homeHref: 'claire-home.html' },
  april:  { name: 'April',  semKey: 'TG11S1', semLabel: 'Grade 11 · Semester 1', target: null, homeHref: 'april-home.html' },
};

const ACTIVITY_TYPES = ['OET Practice', 'Speaking', 'Listening', 'Reading', 'Writing', 'Other'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMonth(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function fmtDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtHours(totalMinutes) {
  const h = totalMinutes / 60;
  return h % 1 === 0 ? String(h) : h.toFixed(1);
}

export function EnglishTracking({ scholarKey }) {
  const config = CONFIGS[scholarKey] || CONFIGS.claire;
  const [sessions, setSessions] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: today(),
    duration: '',
    activity_type: ACTIVITY_TYPES[0],
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('english_sessions')
        .select('id, date, duration_minutes, activity_type, notes')
        .eq('scholar', scholarKey)
        .eq('sem', config.semKey)
        .order('date', { ascending: false });
      setSessions(data ?? []);
    }
    load();
  }, [scholarKey, config.semKey]);

  const totalMinutes = sessions ? sessions.reduce((s, r) => s + (r.duration_minutes || 0), 0) : 0;
  const pct = config.target ? Math.min(100, (totalMinutes / 60 / config.target) * 100) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    const minutes = parseInt(form.duration, 10);
    if (!minutes || minutes < 1) return;

    setSubmitting(true);
    setError(null);

    const tempId = `temp-${Date.now()}`;
    const newSession = {
      scholar: scholarKey,
      sem: config.semKey,
      date: form.date,
      duration_minutes: minutes,
      activity_type: form.activity_type,
      notes: form.notes.trim() || null,
    };

    // optimistic add — insert at top then sort by date descending
    setSessions(prev => {
      const updated = [{ ...newSession, id: tempId }, ...(prev ?? [])];
      return updated.sort((a, b) => b.date.localeCompare(a.date));
    });
    setShowForm(false);
    setForm({ date: today(), duration: '', activity_type: ACTIVITY_TYPES[0], notes: '' });

    const { data, error: err } = await supabase
      .from('english_sessions')
      .insert(newSession)
      .select()
      .single();

    if (err) {
      setSessions(prev => prev.filter(s => s.id !== tempId));
      setError('Could not save. Please try again.');
      setShowForm(true);
    } else {
      setSessions(prev => prev.map(s => s.id === tempId ? data : s));
    }
    setSubmitting(false);
  }

  // group by month label, preserving order (sessions already sorted desc)
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
          <p className="sp-greet-kicker">{config.name}</p>
          <h1 className="sp-greet-name">English<br/>Hours.</h1>
          <div className="sp-head-rule" />
          <div className="sp-head-meta">
            <span className="sp-stage">{config.semLabel}</span>
            <a href={config.homeHref} className="sp-tagline" style={{ textDecoration: 'none' }}>
              ← Back to home
            </a>
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
                  {config.target && (
                    <span className="et-hours-target">/ {config.target}</span>
                  )}
                </div>
                {pct !== null && (
                  <>
                    <div className="et-bar-track">
                      <div className="et-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="et-progress-meta">{pct.toFixed(0)}% of semester target</div>
                  </>
                )}
                {pct === null && (
                  <div className="et-progress-meta">No semester target set</div>
                )}
              </>
            )}
          </div>

          {error && <div className="et-error">{error}</div>}

          {!showForm ? (
            <button className="et-log-btn" onClick={() => setShowForm(true)}>
              + Log session
            </button>
          ) : (
            <form className="et-form" onSubmit={handleSubmit}>
              <div className="et-form-head">
                <span>New session</span>
                <button type="button" className="et-form-close" onClick={() => { setShowForm(false); setError(null); }}>×</button>
              </div>

              <div className="et-field">
                <label>Date</label>
                <input
                  type="date"
                  value={form.date}
                  max={today()}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>

              <div className="et-field">
                <label>Duration (minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="600"
                  placeholder="e.g. 90"
                  value={form.duration}
                  onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                  required
                />
              </div>

              <div className="et-field">
                <label>Activity</label>
                <select
                  value={form.activity_type}
                  onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}
                >
                  {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="et-field">
                <label>Notes <span className="et-optional">(optional)</span></label>
                <textarea
                  rows={3}
                  placeholder="What did you practise?"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
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
                    <span className="et-row-dur">{fmtDuration(s.duration_minutes)}</span>
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
