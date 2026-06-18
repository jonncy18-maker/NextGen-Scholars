import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { PublicAskWidget } from '../components/PublicAskWidget.jsx';
import '../styles/vacation-tracker.css';

// State metadata for a single reward trip. The travels table stores one of
// three states: done (taken), booked (confirmed, upcoming), planned (intended).
export const TRIP_STATES = {
  done:    { label: 'Completed', badge: '✓', cls: 'is-done'    },
  booked:  { label: 'Booked',    badge: '✈', cls: 'is-booked'  },
  planned: { label: 'Planned',   badge: '○', cls: 'is-planned' },
};

const FALLBACK = {
  claire:     { name: 'Claire',     homeHref: '/home/claire' },
  april:      { name: 'April',      homeHref: '/home/april' },
  janndilyne: { name: 'Janndilyne', homeHref: '/home/janndilyne' },
};

const DEST_EMOJI = [
  [/cebu/i, '🏝'], [/boracay/i, '🌊'], [/bohol/i, '🏖'],
  [/hong ?kong/i, '🌆'], [/cruise/i, '🚢'], [/taiwan/i, '🚢'],
  [/manila|visa/i, '🛂'], [/u\.?s\.?|united states|america|immersion/i, '✈'],
  [/japan|tokyo/i, '🗼'], [/korea|seoul/i, '🏙'], [/singapore/i, '🌃'],
];

const TRAVEL_CATS = [
  'Flights', 'Hotel & Accommodation', 'Meals & Dining',
  'Activities & Tours', 'Visa & Documents', 'Local Transport',
];

function destEmoji(dest) {
  if (!dest) return '📍';
  const hit = DEST_EMOJI.find(([re]) => re.test(dest));
  return hit ? hit[1] : '📍';
}

function fmtPhp(n) {
  if (!n) return '₱0';
  return '₱' + Math.round(n).toLocaleString('en-US');
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Inline expense entry + list for one completed trip.
function TripExpenseDrawer({ trip, scholarKey, onAdded }) {
  const sem = trip.sem;
  const [expenses, setExpenses]   = useState(null);
  const [open, setOpen]           = useState(false);
  const [item, setItem]           = useState('');
  const [cat, setCat]             = useState(TRAVEL_CATS[0]);
  const [amount, setAmount]       = useState('');
  const [date, setDate]           = useState(todayStr());
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const load = useCallback(() => {
    if (!sem) return;
    supabase
      .from('expenses')
      .select('id, item, cat, amount, date')
      .eq('scholar', scholarKey)
      .eq('sem', sem)
      .eq('bucket', 'travel')
      .order('date', { ascending: true })
      .then(({ data }) => setExpenses(data ?? []));
  }, [scholarKey, sem]);

  useEffect(() => { if (open) load(); }, [open, load]);

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!item.trim() || isNaN(amt) || amt <= 0) {
      setErr('Item and a positive amount are required.');
      return;
    }
    setSaving(true); setErr('');
    try {
      const id = `${scholarKey}_${sem}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const { error } = await supabase.from('expenses').insert({
        id, scholar: scholarKey, sem, item: item.trim(),
        cat, bucket: 'travel', amount: amt, qty: 1,
        date, avb: 'Actual', sent: 'Yes', vendor: '',
      });
      if (error) throw error;
      setItem(''); setAmount(''); setDate(todayStr());
      load();
      if (onAdded) onAdded();
    } catch {
      setErr('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const expTotal = (expenses ?? []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const count = expenses?.length ?? 0;

  return (
    <div className="vt-trip-exp-wrap">
      <button
        className="vt-trip-exp-toggle"
        onClick={() => setOpen(v => !v)}
        type="button"
      >
        <span className="vt-toggle-icon">{open ? '▼' : '▶'}</span>
        {count > 0 ? `Expenses · ${count}` : 'Add expenses'}
      </button>

      {open && (
        <div className="vt-trip-expenses">
          {expenses === null ? (
            <div className="vt-trip-exp-empty">Loading…</div>
          ) : (
            <>
              {expenses.length > 0 && (
                <>
                  <div className="vt-trip-exp-list">
                    {expenses.map(e => (
                      <div key={e.id} className="vt-trip-exp-row">
                        <span className="vt-trip-exp-item">{e.item}</span>
                        <span className="vt-trip-exp-cat">{e.cat}</span>
                        <span className="vt-trip-exp-date">{fmtDate(e.date)}</span>
                        <span className="vt-trip-exp-amt">{fmtPhp(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="vt-trip-exp-total">
                    <span>Total</span>
                    <span>{fmtPhp(expTotal)}</span>
                  </div>
                </>
              )}
              {expenses.length === 0 && (
                <div className="vt-trip-exp-empty">No expenses logged yet.</div>
              )}
            </>
          )}

          <form className="vt-trip-exp-form" onSubmit={handleSubmit}>
            <div className="vt-exp-form-field">
              <label className="vt-exp-form-label">Item</label>
              <input
                className="vt-exp-form-input"
                type="text"
                placeholder="e.g. Round-trip flight"
                value={item}
                onChange={e => setItem(e.target.value)}
              />
            </div>
            <div className="vt-exp-form-row">
              <div className="vt-exp-form-field">
                <label className="vt-exp-form-label">Category</label>
                <select className="vt-exp-form-select" value={cat} onChange={e => setCat(e.target.value)}>
                  {TRAVEL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="vt-exp-form-field">
                <label className="vt-exp-form-label">Amount (₱)</label>
                <input
                  className="vt-exp-form-input"
                  type="number" min="0" step="any"
                  placeholder="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="vt-exp-form-field">
              <label className="vt-exp-form-label">Date</label>
              <input
                className="vt-exp-form-input"
                type="date" value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            {err && <div className="vt-exp-form-err">{err}</div>}
            <button className="vt-exp-form-submit" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Add expense'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function VacationTracker({ scholarKey }) {
  const fallback = FALLBACK[scholarKey] || FALLBACK.claire;
  const [name,       setName]       = useState(fallback.name);
  const [travels,    setTravels]    = useState(null);
  const [actualTotal, setActualTotal] = useState(null);

  useEffect(() => {
    sessionStorage.setItem('ngs_auth_scholar', scholarKey);
  }, [scholarKey]);

  const loadActualTotal = useCallback(() => {
    supabase
      .from('expenses')
      .select('amount')
      .eq('scholar', scholarKey)
      .eq('bucket', 'travel')
      .eq('avb', 'Actual')
      .then(({ data }) => {
        const total = (data ?? []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
        setActualTotal(total > 0 ? total : 0);
      });
  }, [scholarKey]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('scholars').select('first_name').eq('scholar_key', scholarKey).limit(1),
      supabase.from('travels').select('*').eq('scholar', scholarKey).order('id', { ascending: true }),
    ]).then(([scholarRes, travelRes]) => {
      if (cancelled) return;
      const fn = scholarRes.data?.[0]?.first_name;
      if (fn) setName(fn);
      setTravels(travelRes.data ?? []);
    }).catch(() => { if (!cancelled) setTravels([]); });
    loadActualTotal();
    return () => { cancelled = true; };
  }, [scholarKey, loadActualTotal]);

  const trips       = travels ?? [];
  const completed   = trips.filter(t => t.state === 'done');
  const upcoming    = trips.filter(t => t.state !== 'done');
  const nextTrip    = upcoming[0] || null;
  const estimatedTotal = trips.reduce((s, t) => s + (Number(t.amount_php) || 0), 0);

  // Prefer actual tracked spend if any has been entered; fall back to estimates.
  const hasActual   = actualTotal != null && actualTotal > 0;
  const displayTotal = hasActual ? actualTotal : estimatedTotal;
  const totalLabel   = hasActual ? 'Travel actual' : 'Travel estimated';

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
          <p className="sp-greet-kicker">{name}</p>
          <h1 className="sp-greet-name">Worlds<br/>opened.</h1>
          <div className="sp-head-rule" />
          <div className="sp-head-meta">
            <span className="sp-stage">Vacation Tracker</span>
            <Link to={fallback.homeHref} className="sp-tagline" style={{ textDecoration: 'none' }}>
              ← Back to home
            </Link>
          </div>
        </header>

        <section className="sp-section">
          {/* Summary card */}
          <div className="vt-summary">
            {travels === null ? (
              <div className="vt-loading">Loading…</div>
            ) : (
              <div className="vt-summary-grid">
                <div className="vt-stat">
                  <div className="vt-stat-val">{completed.length}</div>
                  <div className="vt-stat-label">Trips taken</div>
                </div>
                <div className="vt-stat">
                  <div className="vt-stat-val">{fmtPhp(displayTotal)}</div>
                  <div className="vt-stat-label">{totalLabel}</div>
                </div>
                <div className="vt-stat">
                  <div className="vt-stat-val vt-stat-val--sm">
                    {nextTrip ? `${destEmoji(nextTrip.dest)} ${nextTrip.dest}` : '—'}
                  </div>
                  <div className="vt-stat-label">Next destination</div>
                </div>
              </div>
            )}
          </div>

          <p className="vt-intro">
            Annual reward trips that scale with each milestone — every destination
            a deliberate widening of horizons.
          </p>

          {/* Timeline */}
          {travels !== null && trips.length > 0 && (
            <div className="vt-timeline">
              {trips.map((t, i) => {
                const meta   = TRIP_STATES[t.state] || TRIP_STATES.planned;
                const isLast = i === trips.length - 1;
                const amt    = Number(t.amount_php) || 0;
                return (
                  <div key={t.id} className={`vt-trip ${meta.cls}`}>
                    <div className="vt-trip-rail">
                      <div className="vt-trip-badge">
                        {t.state === 'done' ? '✓' : destEmoji(t.dest)}
                      </div>
                      {!isLast && <div className="vt-trip-connector" />}
                    </div>
                    <div className="vt-trip-body">
                      <div className="vt-trip-head">
                        <span className="vt-trip-dest">{t.dest}</span>
                        <span className={`vt-trip-pill ${meta.cls}`}>{meta.label}</span>
                      </div>
                      <div className="vt-trip-meta">
                        {t.sem && <span className="vt-trip-sem">{t.sem}</span>}
                        {amt > 0 && <span className="vt-trip-amt">{fmtPhp(amt)}</span>}
                      </div>
                      {t.state === 'done' && t.sem && (
                        <TripExpenseDrawer
                          trip={t}
                          scholarKey={scholarKey}
                          onAdded={loadActualTotal}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {travels !== null && trips.length === 0 && (
            <div className="vt-empty">
              No reward trips logged yet. Your mentor adds destinations as
              milestones are reached.
            </div>
          )}
        </section>

        <PublicAskWidget />

        <footer className="sp-footer">
          <div className="sp-mark">NGS</div>
          <div className="sp-footer-tag">One generation lifts another.</div>
          <Link to="/" className="sp-home-link">← Home</Link>
        </footer>
      </div>
    </div>
  );
}
