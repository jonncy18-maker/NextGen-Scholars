import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api } from '../lib/api.js';
import { ScholarAuthGate } from '../components/ScholarAuthGate.jsx';
import { ScholarShell } from '../components/ScholarShell.jsx';
import { useSessionExpired } from '../hooks/useSessionExpired.js';
import {
  LIVING_KINDS, LIVING_ROLLUPS, LIVING_SEED_CATEGORIES, LIVING_PROMPTS,
  sinkingMonthly,
} from '../constants.js';
import {
  createLivingCategories, updateLivingCategory, deleteLivingCategory, setLivingPlan,
} from '../api-writer.js';
import '../styles/living-budget.css';

// The scholar's own living-expense budget: she defines her categories and sets
// a planned amount for each, and the total is the figure the mentor sends.
//
// This is deliberately NOT the mentor's expense tracker (/entry) and NOT the
// program's semester budget (`budgets` table). See db/living_budget.sql for the
// rule about never summing the two ledgers together.
//
// Phase 1 is planning only — categories and planned amounts. Actuals, envelope
// tracking and sinking accrual balances land in Phase 2.

const FALLBACK = {
  claire:     { name: 'Claire'     },
  april:      { name: 'April'      },
  janndilyne: { name: 'Janndilyne' },
};

function fmtPhp(n) {
  const v = Number(n) || 0;
  return '₱' + Math.round(v).toLocaleString('en-US');
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function LivingBudget({ scholarKey }) {
  const fallback = FALLBACK[scholarKey] || FALLBACK.claire;

  const [authed, setAuthed] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [name, setName] = useState(fallback.name);

  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [cats, setCats] = useState(null);          // null = still loading
  const [plan, setPlan] = useState({});            // category_id -> planned_php
  const [loading, setLoading] = useState(false);   // a month's amounts are in flight
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Seeding is a one-shot per scholar per session. Without this the seed
  // branch below re-fires on every month change for a scholar who has
  // archived all her categories, posting a wasted seed each time she taps ‹.
  const seeded = useRef(null);

  useSessionExpired(() => {
    if (!authed) return;
    setSessionExpired(true);
    setAuthed(false);
    setCats(null);
    setPlan({});
  });

  // Load categories + this month's plan. Gated on `authed` AND with `authed` in
  // the deps array — React fires effects on mount regardless of what the
  // component renders, so an effect guarded only by the JSX auth gate would
  // still fetch on mount using whatever session cookie the browser already
  // has (i.e. the PREVIOUS scholar's, if they navigated straight here from
  // another scholar's dashboard). That is the documented cause of the
  // "scholar sees another scholar's numbers" bug — see CLAUDE.md.
  const load = useCallback(async () => {
    const [catRows, planRows] = await Promise.all([
      api.get('/living/categories'),
      api.get(`/living/plan?month=${month}`),
    ]);

    const planMap = {};
    (planRows ?? []).forEach(r => { planMap[r.category_id] = Number(r.planned_php) || 0; });

    return { catRows: catRows ?? [], planMap };
  }, [month]);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;

    // Drop the previous month's amounts immediately. Leaving them on screen
    // while the new month loads isn't just visually wrong: blurring an input
    // in that window would write the OLD month's figure into the NEW month.
    // `loading` keeps the inputs inert until the real values arrive.
    setPlan({});
    setLoading(true);

    (async () => {
      try {
        let { catRows, planMap } = await load();

        // First visit: seed the starter set rather than showing a blank page.
        // Idempotent server-side (unique index on scholar + lower(name)), so a
        // double-mount or a second tab cannot duplicate it.
        if (catRows.length === 0 && seeded.current !== scholarKey) {
          seeded.current = scholarKey;
          try {
            await createLivingCategories(scholarKey, LIVING_SEED_CATEGORIES, { restoreArchived: false });
          } catch (err) {
            // Release the claim, or a failed seed (offline, 500) would leave
            // her staring at the empty state for the rest of the session with
            // no retry path short of a full reload.
            seeded.current = null;
            throw err;
          }
          ({ catRows, planMap } = await load());
        }

        if (cancelled) return;
        setCats(catRows);
        setPlan(planMap);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setCats([]);
        setError(err?.message || 'Could not load your budget.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [scholarKey, authed, month, load]);

  const active = useMemo(
    () => (cats ?? []).filter(c => !c.archived_at),
    [cats],
  );

  const total = useMemo(
    () => active.reduce((sum, c) => sum + (Number(plan[c.id]) || 0), 0),
    [active, plan],
  );

  const byRollup = useMemo(() => {
    const out = {};
    active.forEach(c => {
      const amt = Number(plan[c.id]) || 0;
      if (!amt) return;
      out[c.rollup] = (out[c.rollup] || 0) + amt;
    });
    return out;
  }, [active, plan]);

  // Which of the "commonly forgotten" prompts she hasn't added yet.
  const openPrompts = useMemo(() => {
    const taken = new Set((cats ?? []).map(c => c.name.toLowerCase()));
    return LIVING_PROMPTS.filter(p => !taken.has(p.name.toLowerCase()));
  }, [cats]);

  async function savePlan(categoryId, value) {
    const amount = Math.max(0, Number(value) || 0);
    // Optimistic, but remember what to put back. Without the rollback a
    // rejected write left the row and the monthly total displaying the new
    // figure as though it had saved, and a later reload silently reverted it —
    // the worst failure mode for a number she's about to act on.
    const prior = plan[categoryId];
    setPlan(p => ({ ...p, [categoryId]: amount }));
    try {
      await setLivingPlan({ month, category_id: categoryId, planned_php: amount });
    } catch (err) {
      setPlan(p => {
        const next = { ...p };
        if (prior === undefined) delete next[categoryId];
        else next[categoryId] = prior;
        return next;
      });
      setError(err?.message || 'Could not save that amount — it has not been changed.');
    }
  }

  async function addCategory(cat) {
    setBusy(true);
    try {
      await createLivingCategories(scholarKey, cat);
      const { catRows, planMap } = await load();
      setCats(catRows);
      setPlan(planMap);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Could not add that category.');
    } finally {
      setBusy(false);
    }
  }

  async function patchCategory(id, fields) {
    try {
      await updateLivingCategory(id, fields);
      const { catRows } = await load();
      setCats(catRows);
    } catch (err) {
      setError(err?.message || 'Could not update that category.');
    }
  }

  async function removeCategory(id) {
    try {
      await deleteLivingCategory(id);
      const { catRows, planMap } = await load();
      setCats(catRows);
      setPlan(planMap);
    } catch (err) {
      setError(err?.message || 'Could not remove that category.');
    }
  }

  if (!authed) {
    return (
      <ScholarAuthGate
        scholarKey={scholarKey}
        name={fallback.name}
        sessionExpired={sessionExpired}
        onUnlock={(profile) => {
          if (profile?.firstName) setName(profile.firstName);
          setSessionExpired(false);
          setAuthed(true);
        }}
      />
    );
  }

  return (
    <ScholarShell
      scholarKey={scholarKey}
      name={name}
      active="budget"
      eyebrow="My Budget"
      title={monthLabel(month)}
      subtitle="What you plan to spend this month — you decide the categories"
      identityRole="Scholar"
      onSignOut={() => { setAuthed(false); setCats(null); setPlan({}); }}
    >
      <div className="lb-monthbar">
        <button className="lb-monthnav" onClick={() => setMonth(m => shiftMonth(m, -1))}>‹</button>
        <span className="lb-monthlabel">{monthLabel(month)}</span>
        <button className="lb-monthnav" onClick={() => setMonth(m => shiftMonth(m, 1))}>›</button>
      </div>

      {error && <div className="lb-error">{error}</div>}

      <section className="lb-total-card">
        <div className="lb-total-label">Monthly total</div>
        <div className="lb-total-value">{fmtPhp(total)}</div>
        <div className="lb-total-hint">
          This is the figure your budget adds up to. Fill in every category you can think of —
          it is better to be a little over than to run out in week three.
        </div>
        {Object.keys(byRollup).length > 0 && (
          <div className="lb-rollups">
            {LIVING_ROLLUPS.filter(r => byRollup[r.key]).map(r => (
              <div key={r.key} className="lb-rollup">
                <span className="lb-rollup-label">{r.label}</span>
                <span className="lb-rollup-value">{fmtPhp(byRollup[r.key])}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {cats === null ? (
        <div className="lb-loading">Loading your budget…</div>
      ) : (
        <>
          <section className="lb-list">
            {active.map(cat => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                value={plan[cat.id] ?? ''}
                disabled={loading}
                onAmount={v => savePlan(cat.id, v)}
                onPatch={fields => patchCategory(cat.id, fields)}
                onRemove={() => removeCategory(cat.id)}
              />
            ))}
            {active.length === 0 && (
              <div className="lb-empty">No categories yet — add your first one below.</div>
            )}
          </section>

          <AddCategory busy={busy} onAdd={addCategory} />

          {openPrompts.length > 0 && (
            <section className="lb-prompts">
              <h3 className="lb-prompts-title">Easy to forget</h3>
              <p className="lb-prompts-sub">
                These are real costs that do not arrive every month, so they are the ones that
                catch people out. Tap to add any that apply to you.
              </p>
              <div className="lb-prompt-chips">
                {openPrompts.map(p => (
                  <button
                    key={p.name}
                    className="lb-chip"
                    disabled={busy}
                    onClick={() => addCategory(p)}
                    title={p.hint || ''}
                  >
                    + {p.name}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </ScholarShell>
  );
}

// One category: name, kind, planned amount, and (for sinking funds) the
// target/months that produce a monthly accrual.
function CategoryRow({ cat, value, disabled, onAmount, onPatch, onRemove }) {
  const [local, setLocal] = useState(value === '' ? '' : String(value));
  const [open, setOpen] = useState(false);

  // Keep the input in step when the month changes underneath it.
  useEffect(() => { setLocal(value === '' ? '' : String(value)); }, [value]);

  const accrual = sinkingMonthly(cat);
  const kind = LIVING_KINDS.find(k => k.key === cat.kind);

  return (
    <div className={`lb-row is-${cat.kind}`}>
      <div className="lb-row-main">
        <div className="lb-row-id">
          <div className="lb-row-name">{cat.name}</div>
          <div className="lb-row-meta">
            <span className={`lb-kind lb-kind-${cat.kind}`}>{kind?.label ?? cat.kind}</span>
            {cat.kind === 'sinking' && accrual > 0 && (
              <span className="lb-accrual">
                {fmtPhp(cat.sinking_target_php)} ÷ {cat.sinking_months} mo ≈ {fmtPhp(accrual)}/mo
              </span>
            )}
          </div>
        </div>

        <div className="lb-row-amount">
          <span className="lb-peso">₱</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            className="lb-amount-input"
            value={local}
            placeholder="0"
            disabled={disabled}
            onChange={e => setLocal(e.target.value)}
            onBlur={() => { if (!disabled) onAmount(local); }}
          />
        </div>

        <button
          className="lb-row-toggle"
          onClick={() => setOpen(o => !o)}
          aria-label={`Edit ${cat.name}`}
        >
          {open ? '×' : '⋯'}
        </button>
      </div>

      {open && (
        <div className="lb-row-edit">
          <label className="lb-field">
            <span>Name</span>
            <input
              defaultValue={cat.name}
              onBlur={e => {
                const v = e.target.value.trim();
                if (v && v !== cat.name) onPatch({ name: v });
              }}
            />
          </label>

          <label className="lb-field">
            <span>Type</span>
            <select value={cat.kind} onChange={e => onPatch({ kind: e.target.value })}>
              {LIVING_KINDS.map(k => (
                <option key={k.key} value={k.key}>{k.label} — {k.hint}</option>
              ))}
            </select>
          </label>

          <label className="lb-field">
            <span>Group</span>
            <select value={cat.rollup} onChange={e => onPatch({ rollup: e.target.value })}>
              {LIVING_ROLLUPS.map(r => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </label>

          {cat.kind === 'sinking' && (
            <>
              <label className="lb-field">
                <span>Total cost</span>
                <input
                  type="number" min="0" defaultValue={cat.sinking_target_php ?? ''}
                  onBlur={e => onPatch({ sinking_target_php: e.target.value === '' ? null : e.target.value })}
                />
              </label>
              <label className="lb-field">
                <span>Due in (months)</span>
                <input
                  type="number" min="1" defaultValue={cat.sinking_months ?? ''}
                  onBlur={e => onPatch({ sinking_months: e.target.value === '' ? null : e.target.value })}
                />
              </label>
            </>
          )}

          <button className="lb-remove" onClick={onRemove}>Remove this category</button>
        </div>
      )}
    </div>
  );
}

function AddCategory({ busy, onAdd }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('variable');
  const [rollup, setRollup] = useState('personal');

  function submit(e) {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    onAdd({ name: v, kind, rollup });
    setName('');
    setKind('variable');
    setRollup('personal');
  }

  return (
    <form className="lb-add" onSubmit={submit}>
      <input
        className="lb-add-name"
        placeholder="Add your own category…"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <select value={kind} onChange={e => setKind(e.target.value)}>
        {LIVING_KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
      </select>
      <select value={rollup} onChange={e => setRollup(e.target.value)}>
        {LIVING_ROLLUPS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
      </select>
      <button type="submit" disabled={busy || !name.trim()}>Add</button>
    </form>
  );
}
