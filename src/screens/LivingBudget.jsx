import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api } from '../lib/api.js';
import { ScholarAuthGate } from '../components/ScholarAuthGate.jsx';
import { ScholarShell } from '../components/ScholarShell.jsx';
import { BudgetAskPanel } from '../components/BudgetAskPanel.jsx';
import { useSessionExpired } from '../hooks/useSessionExpired.js';
import {
  LIVING_KINDS,
  LIVING_ROLLUPS,
  LIVING_SEED_CATEGORIES,
  LIVING_PROMPTS,
  LIVING_BASES,
  sinkingMonthly,
  itemMonthlyPhp,
  itemsTotalPhp,
} from '../constants.js';
import {
  createLivingCategories,
  updateLivingCategory,
  deleteLivingCategory,
  setLivingPlan,
  setLivingItems,
} from '../api-writer.js';
import '../styles/living-budget.css';

// The scholar's own living-expense budget, in two halves:
//
//   Budget — read-only. What the plan says, grouped by kind, either as this
//            month's detail or as a run of months through December.
//   Build  — where it changes. Every category editable, with a line-item
//            builder behind each one.
//
// This is deliberately NOT the mentor's expense tracker (/entry) and NOT the
// program's semester budget (`budgets` table). See db/living_budget.sql for the
// rule about never summing the two ledgers together.

const FALLBACK = {
  claire: { name: 'Claire' },
  april: { name: 'April' },
  janndilyne: { name: 'Janndilyne' },
  demo: { name: 'Demo' },
};

// Render order for the three groups. `kind` values are the DB's
// (fixed/variable/sinking); the human-facing labels come from LIVING_KINDS.
const KIND_ORDER = ['fixed', 'variable', 'sinking'];

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

function monthShort(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

// This month through December of the same year — the horizon the "Through
// December" view projects over. December itself returns a single column rather
// than an empty run.
function monthsToYearEnd(key) {
  const [y, m] = key.split('-').map(Number);
  const out = [];
  for (let mm = m; mm <= 12; mm++) {
    out.push(`${y}-${String(mm).padStart(2, '0')}`);
  }
  return out;
}

export function LivingBudget({ scholarKey }) {
  const fallback = FALLBACK[scholarKey] || FALLBACK.claire;

  const [authed, setAuthed] = useState(false);
  const [isMentor, setIsMentor] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [name] = useState(fallback.name);

  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [cats, setCats] = useState(null); // null = still loading
  const [plan, setPlan] = useState({}); // category_id -> planned_php
  const [items, setItems] = useState({}); // category_id -> [item rows]
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [tab, setTab] = useState('budget'); // 'budget' | 'build'
  const [view, setView] = useState('detail'); // 'detail' | 'year'
  const [collapsed, setCollapsed] = useState(() => new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [builderFor, setBuilderFor] = useState(null); // category row

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
    setItems({});
  });

  // `scholar` is always sent, even though the API infers it for a scholar
  // caller. A MENTOR is unscoped by default, so without it they'd get every
  // scholar's categories merged into one list on whichever /budget/:scholar
  // page they opened.
  const load = useCallback(async () => {
    const q = `scholar=${encodeURIComponent(scholarKey)}`;
    const [catRows, planRows, itemRows] = await Promise.all([
      api.get(`/living/categories?${q}`),
      api.get(`/living/plan?month=${month}&${q}`),
      api.get(`/living/items?month=${month}&${q}`),
    ]);

    const planMap = {};
    (planRows ?? []).forEach((r) => {
      planMap[r.category_id] = Number(r.planned_php) || 0;
    });

    const itemMap = {};
    (itemRows ?? []).forEach((r) => {
      (itemMap[r.category_id] ??= []).push({
        ...r,
        qty: Number(r.qty) || 0,
        unit_php: Number(r.unit_php) || 0,
      });
    });

    return { catRows: catRows ?? [], planMap, itemMap };
  }, [month, scholarKey]);

  // Gated on `authed` AND with `authed` in the deps array — React fires effects
  // on mount regardless of what the component renders, so an effect guarded
  // only by the JSX auth gate would still fetch on mount using whatever session
  // cookie the browser already has (i.e. the PREVIOUS scholar's, if they
  // navigated straight here from another scholar's dashboard). That is the
  // documented cause of the "scholar sees another scholar's numbers" bug —
  // see CLAUDE.md.
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;

    // Drop the previous month's amounts immediately. Leaving them on screen
    // while the new month loads isn't just visually wrong: blurring an input
    // in that window would write the OLD month's figure into the NEW month.
    setPlan({});
    setItems({});
    setLoading(true);

    (async () => {
      try {
        let { catRows, planMap, itemMap } = await load();

        // First visit: seed the starter set rather than showing a blank page.
        // Idempotent server-side (unique index on scholar + lower(name)), so a
        // double-mount or a second tab cannot duplicate it.
        if (catRows.length === 0 && seeded.current !== scholarKey) {
          seeded.current = scholarKey;
          try {
            await createLivingCategories(scholarKey, LIVING_SEED_CATEGORIES, {
              restoreArchived: false,
            });
          } catch (err) {
            // Release the claim, or a failed seed (offline, 500) would leave
            // her staring at the empty state for the rest of the session with
            // no retry path short of a full reload.
            seeded.current = null;
            throw err;
          }
          ({ catRows, planMap, itemMap } = await load());
        }

        if (cancelled) return;
        setCats(catRows);
        setPlan(planMap);
        setItems(itemMap);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setCats([]);
        setError(err?.message || 'Could not load your budget.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scholarKey, authed, month, load]);

  const active = useMemo(() => (cats ?? []).filter((c) => !c.archived_at), [cats]);

  const amountOf = useCallback((cat) => Number(plan[cat.id]) || 0, [plan]);

  const total = useMemo(() => active.reduce((sum, c) => sum + amountOf(c), 0), [active, amountOf]);

  // The three groups, in a fixed order, each with its own total. Categories
  // with no planned amount still appear in Build (as the "not budgeted yet"
  // rows) but are excluded from the Budget view's lists.
  const groups = useMemo(
    () =>
      KIND_ORDER.map((kind) => {
        const meta = LIVING_KINDS.find((k) => k.key === kind);
        const all = active.filter((c) => c.kind === kind);
        const set = all.filter((c) => amountOf(c) > 0).sort((a, b) => amountOf(b) - amountOf(a));
        return {
          kind,
          label: meta?.label ?? kind,
          hint: meta?.hint ?? '',
          all,
          rows: set,
          unset: all.filter((c) => amountOf(c) <= 0),
          total: set.reduce((s, c) => s + amountOf(c), 0),
        };
      }),
    [active, amountOf]
  );

  const unbudgetedCount = useMemo(() => groups.reduce((n, g) => n + g.unset.length, 0), [groups]);

  // Which of the "commonly forgotten" prompts she hasn't added yet.
  const openPrompts = useMemo(() => {
    const taken = new Set((cats ?? []).map((c) => c.name.toLowerCase()));
    return LIVING_PROMPTS.filter((p) => !taken.has(p.name.toLowerCase()));
  }, [cats]);

  const horizon = useMemo(() => monthsToYearEnd(month), [month]);

  async function savePlan(categoryId, value) {
    const amount = Math.max(0, Number(value) || 0);
    // Optimistic, but remember what to put back. Without the rollback a
    // rejected write left the row and the monthly total displaying the new
    // figure as though it had saved, and a later reload silently reverted it —
    // the worst failure mode for a number she's about to act on.
    const prior = plan[categoryId];
    setPlan((p) => ({ ...p, [categoryId]: amount }));
    try {
      await setLivingPlan({ month, category_id: categoryId, planned_php: amount });
    } catch (err) {
      setPlan((p) => {
        const next = { ...p };
        if (prior === undefined) delete next[categoryId];
        else next[categoryId] = prior;
        return next;
      });
      setError(err?.message || 'Could not save that amount — it has not been changed.');
    }
  }

  const refresh = useCallback(async () => {
    try {
      const { catRows, planMap, itemMap } = await load();
      setCats(catRows);
      setPlan(planMap);
      setItems(itemMap);
    } catch (err) {
      setError(err?.message || 'Could not refresh your budget.');
    }
  }, [load]);

  async function addCategory(cat, { thenBuild = false } = {}) {
    setBusy(true);
    try {
      const rows = await createLivingCategories(scholarKey, cat);
      await refresh();
      setError(null);
      if (thenBuild && rows?.[0]) setBuilderFor(rows[0]);
      return rows?.[0] ?? null;
    } catch (err) {
      setError(err?.message || 'Could not add that category.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function patchCategory(id, fields) {
    try {
      await updateLivingCategory(id, fields);
      await refresh();
    } catch (err) {
      setError(err?.message || 'Could not update that category.');
    }
  }

  async function removeCategory(id) {
    try {
      await deleteLivingCategory(id);
      await refresh();
    } catch (err) {
      setError(err?.message || 'Could not remove that category.');
    }
  }

  // The builder writes items AND the rolled-up total in one server call, so
  // there is no separate savePlan() here — see app/api/living/items/route.js.
  async function saveBuilder(cat, mode, payload) {
    setBusy(true);
    try {
      if (mode === 'items') {
        await setLivingItems({ month, category_id: cat.id, items: payload });
      } else {
        // Switching an itemised category back to a simple amount. No explicit
        // clear needed: PUT /living/plan drops any breakdown for that month
        // itself, so every "just set the total" path stays consistent whether
        // it comes from here, the inline amount box, or the AI panel.
        await setLivingPlan({ month, category_id: cat.id, planned_php: payload });
      }
      await refresh();
      setError(null);
      setBuilderFor(null);
    } catch (err) {
      setError(err?.message || 'Could not save that budget.');
    } finally {
      setBusy(false);
    }
  }

  function toggleGroup(kind) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });
  }

  const allCollapsed = collapsed.size === KIND_ORDER.length;
  function toggleAll() {
    setCollapsed(allCollapsed ? new Set() : new Set(KIND_ORDER));
  }

  if (!authed) {
    return (
      <ScholarAuthGate
        scholarKey={scholarKey}
        name={fallback.name}
        sessionExpired={sessionExpired}
        // Safe here, and ONLY here: every fetch on this screen sends
        // ?scholar=, so a mentor sees exactly one scholar's budget. See the
        // note on mayView() before adding this to another screen.
        allowMentor
        onUnlock={(me) => {
          setIsMentor(me?.role === 'mentor');
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
      subtitle={
        isMentor
          ? `Viewing ${fallback.name}'s budget as mentor — edits here change her plan`
          : 'What you plan to spend this month — you decide the categories'
      }
      identityRole={isMentor ? 'Mentor' : 'Scholar'}
      onSignOut={() => {
        setAuthed(false);
        setCats(null);
        setPlan({});
        setItems({});
      }}
    >
      <div className="lb-tabs" role="tablist">
        <button
          className="lb-tab"
          role="tab"
          aria-selected={tab === 'budget'}
          onClick={() => setTab('budget')}
        >
          Budget
        </button>
        <button
          className="lb-tab"
          role="tab"
          aria-selected={tab === 'build'}
          onClick={() => setTab('build')}
        >
          Build
          {cats && (
            <span className="lb-tab-cnt">
              {active.length} categor{active.length === 1 ? 'y' : 'ies'}
              {unbudgetedCount > 0 ? ` · ${unbudgetedCount} unbudgeted` : ''}
            </span>
          )}
        </button>
      </div>

      <div className="lb-monthbar">
        <div className="lb-monthnav">
          <button
            className="lb-monthnav-btn"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="lb-monthlabel">{monthLabel(month)}</span>
          <button
            className="lb-monthnav-btn"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        {tab === 'budget' && (
          <div className="lb-seg" role="tablist">
            <button role="tab" aria-selected={view === 'detail'} onClick={() => setView('detail')}>
              Detail
            </button>
            <button role="tab" aria-selected={view === 'year'} onClick={() => setView('year')}>
              Through December
            </button>
          </div>
        )}
        {tab === 'build' && (
          <button className="lb-btn lb-btn-primary" onClick={() => setAddOpen(true)}>
            + Add category
          </button>
        )}
      </div>

      {error && <div className="lb-error">{error}</div>}

      {cats === null ? (
        <div className="lb-loading">Loading your budget…</div>
      ) : tab === 'budget' ? (
        <>
          <section className="lb-total-card">
            <div className="lb-total-top">
              <div>
                <div className="lb-total-label">Planned this month</div>
                <div className="lb-total-value">{fmtPhp(total)}</div>
              </div>
            </div>
            <div className="lb-splits">
              {groups.map((g) => (
                <div key={g.kind} className={`lb-split is-${g.kind}`}>
                  <div className="lb-split-hd">
                    <span className="lb-split-dot" />
                    <span className="lb-split-name">{g.label}</span>
                  </div>
                  <div className="lb-split-amt">{fmtPhp(g.total)}</div>
                  <div className="lb-split-sub">
                    {g.rows.length} categor{g.rows.length === 1 ? 'y' : 'ies'}
                    {total > 0 ? ` · ${Math.round((g.total / total) * 100)}% of plan` : ''}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {view === 'detail' ? (
            <>
              <div className="lb-grouptools">
                <button className="lb-linkbtn" onClick={toggleAll}>
                  {allCollapsed ? 'Expand all' : 'Collapse all'}
                </button>
              </div>
              {groups.map((g) => (
                <SummaryGroup
                  key={g.kind}
                  group={g}
                  total={total}
                  items={items}
                  amountOf={amountOf}
                  collapsed={collapsed.has(g.kind)}
                  onToggle={() => toggleGroup(g.kind)}
                />
              ))}
              {total === 0 && (
                <div className="lb-empty">
                  Nothing budgeted for {monthLabel(month)} yet — switch to <b>Build</b> to start.
                </div>
              )}
            </>
          ) : (
            <YearView groups={groups} horizon={horizon} amountOf={amountOf} />
          )}
        </>
      ) : (
        <>
          {groups.map((g) => (
            <BuildGroup
              key={g.kind}
              group={g}
              items={items}
              plan={plan}
              disabled={loading}
              onAmount={(id, v) => savePlan(id, v)}
              onBuild={setBuilderFor}
              onPatch={patchCategory}
              onRemove={removeCategory}
            />
          ))}

          <BudgetAskPanel
            scholarKey={scholarKey}
            month={month}
            // All categories, not just active ones, so an op naming an
            // archived category still renders with its real name.
            categories={cats ?? []}
            onApplied={refresh}
          />

          {openPrompts.length > 0 && (
            <section className="lb-prompts">
              <h3 className="lb-prompts-title">Easy to forget</h3>
              <p className="lb-prompts-sub">
                Real costs that do not arrive every month, so they are the ones that catch people
                out. Tap to add any that apply to you.
              </p>
              <div className="lb-prompt-chips">
                {openPrompts.map((p) => (
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

      {addOpen && (
        <AddCategoryModal
          busy={busy}
          onCancel={() => setAddOpen(false)}
          onSave={async (cat, thenBuild) => {
            const row = await addCategory(cat, { thenBuild });
            if (row) setAddOpen(false);
          }}
        />
      )}

      {builderFor && (
        <BuilderModal
          cat={builderFor}
          month={month}
          existingItems={items[builderFor.id] || []}
          currentAmount={Number(plan[builderFor.id]) || 0}
          busy={busy}
          onCancel={() => setBuilderFor(null)}
          onSave={(mode, payload) => saveBuilder(builderFor, mode, payload)}
        />
      )}
    </ScholarShell>
  );
}

// ── Budget view ────────────────────────────────────────────────────────────

function SummaryGroup({ group, total, items, amountOf, collapsed, onToggle }) {
  return (
    <section className={`lb-group is-${group.kind}${collapsed ? ' is-collapsed' : ''}`}>
      <div
        className="lb-group-hd"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <span className="lb-group-arrow">▼</span>
        <span className="lb-group-name">{group.label}</span>
        <span className="lb-group-hint">{group.hint}</span>
        <span className="lb-group-total">{fmtPhp(group.total)}</span>
      </div>
      {!collapsed && (
        <div className="lb-group-body">
          {group.rows.length === 0 ? (
            <div className="lb-group-empty">Nothing here yet.</div>
          ) : (
            group.rows.map((cat) => (
              <SummaryLine
                key={cat.id}
                cat={cat}
                items={items[cat.id]}
                amount={amountOf(cat)}
                total={total}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}

function SummaryLine({ cat, items, amount, total }) {
  // living_plan.planned_php is authoritative for both simple and itemised
  // categories: app/api/living/items writes the rolled-up total there in the
  // same call that saves the items, so there is no second figure to reconcile.
  const built = (items || []).length;
  const accrual = sinkingMonthly(cat);
  return (
    <div className="lb-line">
      <span className="lb-line-name">{cat.name}</span>
      {built > 0 && (
        <span className="lb-line-note">
          {built} item{built === 1 ? '' : 's'}
        </span>
      )}
      {cat.kind === 'sinking' && accrual > 0 && (
        <span className="lb-line-note">
          {fmtPhp(cat.sinking_target_php)} ÷ {cat.sinking_months} mo
        </span>
      )}
      <span className="lb-line-spacer" />
      <span className="lb-line-amt">{fmtPhp(amount)}</span>
      <span className="lb-line-share">
        {total > 0 ? `${Math.round((amount / total) * 100)}%` : '—'}
      </span>
    </div>
  );
}

function YearView({ groups, horizon, amountOf }) {
  const monthTotals = horizon.map(() =>
    groups.reduce((s, g) => s + g.rows.reduce((t, c) => t + amountOf(c), 0), 0)
  );
  const grand = monthTotals.reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="lb-matrix-card">
        <div className="lb-matrix-scroll">
          <table className="lb-matrix">
            <thead>
              <tr>
                <th className="lb-mx-cat">Category</th>
                {horizon.map((m, i) => (
                  <th key={m} className={i === 0 ? 'is-now' : undefined}>
                    {monthShort(m)}
                  </th>
                ))}
                <th>Rest of year</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g.kind}>
                  <tr className={`lb-mx-krow is-${g.kind}`}>
                    <td className="lb-mx-cat" colSpan={horizon.length + 2}>
                      {g.label}
                      {g.kind === 'sinking' && (
                        <span className="lb-mx-krow-sub"> (monthly set-aside)</span>
                      )}
                    </td>
                  </tr>
                  {g.rows.map((cat) => {
                    const amt = amountOf(cat);
                    return (
                      <tr key={cat.id}>
                        <td className="lb-mx-cat">{cat.name}</td>
                        {horizon.map((m, i) => (
                          <td key={m} className={i === 0 ? 'is-now' : undefined}>
                            {Math.round(amt).toLocaleString('en-US')}
                            {cat.sinking_due_month === m && (
                              <span
                                className="lb-mx-due"
                                title="Money actually leaves this month"
                              />
                            )}
                          </td>
                        ))}
                        <td>{Math.round(amt * horizon.length).toLocaleString('en-US')}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
              <tr className="lb-mx-total">
                <td className="lb-mx-cat">Monthly total</td>
                {monthTotals.map((t, i) => (
                  <td key={horizon[i]} className={i === 0 ? 'is-now' : undefined}>
                    {Math.round(t).toLocaleString('en-US')}
                  </td>
                ))}
                <td>{Math.round(grand).toLocaleString('en-US')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="lb-legend">
          <span>
            <i className="lb-mx-due" /> Money actually leaves this month
          </span>
          <span>Shaded column = current month</span>
          <span>All figures ₱</span>
        </div>
      </div>

      <div className="lb-rules">
        <h4>How future months are projected</h4>
        <ul>
          <li>
            <b>Fixed</b> repeats at the same amount until you change it.
          </li>
          <li>
            <b>Flexible</b> repeats at this month's amount as an estimate — change any month in
            Build.
          </li>
          <li>
            <b>Non-recurring</b> shows the monthly set-aside, not the bill.
          </li>
        </ul>
      </div>
    </>
  );
}

// ── Build view ─────────────────────────────────────────────────────────────

function BuildGroup({ group, items, plan, disabled, onAmount, onBuild, onPatch, onRemove }) {
  return (
    <section className={`lb-group is-${group.kind}`}>
      <div className="lb-group-hd is-static">
        <span className="lb-group-name">{group.label}</span>
        <span className="lb-group-hint">{group.hint}</span>
        <span className="lb-group-total">{fmtPhp(group.total)}</span>
      </div>
      <div className="lb-group-body">
        {group.rows.map((cat) => (
          <BuildRow
            key={cat.id}
            cat={cat}
            value={plan[cat.id] ?? ''}
            items={items[cat.id] || []}
            disabled={disabled}
            onAmount={(v) => onAmount(cat.id, v)}
            onBuild={() => onBuild(cat)}
            onPatch={(fields) => onPatch(cat.id, fields)}
            onRemove={() => onRemove(cat.id)}
          />
        ))}
        {group.unset.map((cat) => (
          <button key={cat.id} type="button" className="lb-unset" onClick={() => onBuild(cat)}>
            <span className="lb-line-name">{cat.name}</span>
            <span className="lb-line-spacer" />
            <span className="lb-unset-cta">Build budget →</span>
          </button>
        ))}
        {group.all.length === 0 && <div className="lb-group-empty">Nothing in this group yet.</div>}
      </div>
    </section>
  );
}

function BuildRow({ cat, value, items, disabled, onAmount, onBuild, onPatch, onRemove }) {
  const [local, setLocal] = useState(value === '' ? '' : String(value));
  const [open, setOpen] = useState(false);
  const built = items.length;

  // Keep the input in step when the month changes underneath it.
  useEffect(() => {
    setLocal(value === '' ? '' : String(value));
  }, [value]);

  const accrual = sinkingMonthly(cat);

  return (
    <div className="lb-row">
      <div className="lb-row-main">
        <div className="lb-row-id">
          <div className="lb-row-name">{cat.name}</div>
          <div className="lb-row-meta">
            {built > 0 && (
              <button type="button" className="lb-built-tag" onClick={onBuild}>
                built from {built} item{built === 1 ? '' : 's'}
              </button>
            )}
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
            // An itemised category's total belongs to its items. Letting the
            // inline box overwrite it would leave a figure its own breakdown
            // contradicts, so editing goes through the builder instead.
            disabled={disabled || built > 0}
            title={built > 0 ? 'Built from items — open the builder to change it' : undefined}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => {
              if (!disabled && !built) onAmount(local);
            }}
          />
        </div>

        <button className="lb-row-build" onClick={onBuild} title="Open the builder">
          ⊞
        </button>
        <button
          className="lb-row-toggle"
          onClick={() => setOpen((o) => !o)}
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
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== cat.name) onPatch({ name: v });
              }}
            />
          </label>

          <label className="lb-field">
            <span>Type</span>
            <select value={cat.kind} onChange={(e) => onPatch({ kind: e.target.value })}>
              {LIVING_KINDS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label} — {k.hint}
                </option>
              ))}
            </select>
          </label>

          <label className="lb-field">
            <span>Group</span>
            <select value={cat.rollup} onChange={(e) => onPatch({ rollup: e.target.value })}>
              {LIVING_ROLLUPS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          {cat.kind === 'sinking' && (
            <>
              <label className="lb-field">
                <span>Total cost</span>
                <input
                  type="number"
                  min="0"
                  defaultValue={cat.sinking_target_php ?? ''}
                  onBlur={(e) =>
                    onPatch({ sinking_target_php: e.target.value === '' ? null : e.target.value })
                  }
                />
              </label>
              <label className="lb-field">
                <span>Due in (months)</span>
                <input
                  type="number"
                  min="1"
                  defaultValue={cat.sinking_months ?? ''}
                  onBlur={(e) =>
                    onPatch({ sinking_months: e.target.value === '' ? null : e.target.value })
                  }
                />
              </label>
              <label className="lb-field">
                <span>Bill lands (YYYY-MM)</span>
                <input
                  placeholder="2026-12"
                  defaultValue={cat.sinking_due_month ?? ''}
                  onBlur={(e) => onPatch({ sinking_due_month: e.target.value.trim() || null })}
                />
              </label>
            </>
          )}

          <button className="lb-remove" onClick={onRemove}>
            Remove this category
          </button>
        </div>
      )}
    </div>
  );
}

// ── Modals ─────────────────────────────────────────────────────────────────

function AddCategoryModal({ busy, onCancel, onSave }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('variable');
  const [rollup, setRollup] = useState('personal');

  const valid = name.trim().length > 0;
  const cat = { name: name.trim(), kind, rollup };

  return (
    <Scrim onClose={onCancel} labelledBy="lb-add-title">
      <div className="lb-modal">
        <div className="lb-modal-hd">
          <h3 id="lb-add-title">New category</h3>
        </div>
        <div className="lb-modal-body">
          <label className="lb-field">
            <span>What do you call it?</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Medicine &amp; Health"
              autoFocus
            />
          </label>

          <div className="lb-field">
            <span>What kind of cost is it?</span>
            <div className="lb-kindpick" role="radiogroup" aria-label="Category kind">
              {LIVING_KINDS.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.key}
                  className={`lb-kindopt is-${k.key}`}
                  onClick={() => setKind(k.key)}
                >
                  <span className="lb-kindopt-n">{k.label}</span>
                  <span className="lb-kindopt-h">{k.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="lb-field">
            <span>Group</span>
            <select value={rollup} onChange={(e) => setRollup(e.target.value)}>
              {LIVING_ROLLUPS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="lb-modal-ft">
          <span className="lb-ft-note">Save now and set the amount whenever you're ready.</span>
          <button className="lb-btn lb-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="lb-btn lb-btn-ghost"
            disabled={!valid || busy}
            onClick={() => onSave(cat, false)}
          >
            Save
          </button>
          <button
            className="lb-btn lb-btn-primary"
            disabled={!valid || busy}
            onClick={() => onSave(cat, true)}
          >
            Build budget →
          </button>
        </div>
      </div>
    </Scrim>
  );
}

let itemKeySeq = 0;
function blankItem() {
  return { key: `n${++itemKeySeq}`, name: '', qty: '1', unit_php: '', basis: 'month' };
}

function BuilderModal({ cat, month, existingItems, currentAmount, busy, onCancel, onSave }) {
  // Detailed when there is already a breakdown to edit, simple otherwise —
  // whichever mode she is already in is the one she most likely wants.
  const [mode, setMode] = useState(existingItems.length ? 'detail' : 'simple');
  const [rows, setRows] = useState(() =>
    existingItems.length
      ? existingItems.map((it, i) => ({
          key: `e${i}`,
          name: it.name,
          qty: String(it.qty),
          unit_php: String(it.unit_php),
          basis: it.basis,
        }))
      : [blankItem()]
  );
  const [simpleAmt, setSimpleAmt] = useState(String(currentAmount || ''));
  const [simpleBasis, setSimpleBasis] = useState('month');

  const asItems = rows.map((r) => ({
    name: r.name.trim(),
    qty: Number(r.qty) || 0,
    unit_php: Number(r.unit_php) || 0,
    basis: r.basis,
  }));
  const namedItems = asItems.filter((it) => it.name);
  const itemTotal = itemsTotalPhp(namedItems);

  const simplePer = LIVING_BASES.find((b) => b.key === simpleBasis)?.per ?? 1;
  const simpleTotal = Math.round((Number(simpleAmt) || 0) * simplePer);

  function patchRow(key, fields) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...fields } : r)));
  }

  return (
    <Scrim onClose={onCancel} labelledBy="lb-build-title">
      <div className="lb-modal is-wide">
        <div className="lb-modal-hd">
          <h3 id="lb-build-title">{cat.name}</h3>
          <span className="lb-modal-sub">{monthLabel(month)} · averaged month</span>
        </div>

        <div className="lb-modal-body">
          <div className="lb-seg lb-seg-modal" role="tablist">
            <button role="tab" aria-selected={mode === 'simple'} onClick={() => setMode('simple')}>
              Simple
            </button>
            <button role="tab" aria-selected={mode === 'detail'} onClick={() => setMode('detail')}>
              Detailed
            </button>
          </div>

          {mode === 'simple' ? (
            <>
              <div className="lb-simple-wrap">
                <label className="lb-field">
                  <span>Amount</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={simpleAmt}
                    onChange={(e) => setSimpleAmt(e.target.value)}
                    autoFocus
                  />
                </label>
                <label className="lb-field">
                  <span>Per</span>
                  <select value={simpleBasis} onChange={(e) => setSimpleBasis(e.target.value)}>
                    {LIVING_BASES.map((b) => (
                      <option key={b.key} value={b.key}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="lb-simple-out">
                {simpleBasis === 'month' ? (
                  <>{fmtPhp(Number(simpleAmt) || 0)} a month</>
                ) : (
                  <>
                    {fmtPhp(Number(simpleAmt) || 0)} × {simplePer.toFixed(2)} {simpleBasis}s
                  </>
                )}
                {' = '}
                <b>{fmtPhp(simpleTotal)}</b> a month
              </div>
            </>
          ) : (
            <>
              <div className="lb-basisbar">
                <span>
                  Each item carries its own rhythm — <b>daily, weekly or monthly</b>.
                </span>
                <span>
                  An average month: <b>30.44 days · 4.35 weeks</b>
                </span>
              </div>
              <div className="lb-items-scroll">
                <table className="lb-items">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="r">Qty</th>
                      <th className="r">Unit ₱</th>
                      <th>Per</th>
                      <th className="r">Month total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const line = itemMonthlyPhp({
                        qty: Number(r.qty) || 0,
                        unit_php: Number(r.unit_php) || 0,
                        basis: r.basis,
                      });
                      const per = LIVING_BASES.find((b) => b.key === r.basis);
                      const bits = [];
                      if (Number(r.qty) !== 1) bits.push(String(Number(r.qty) || 0));
                      bits.push(String(Number(r.unit_php) || 0));
                      if (r.basis !== 'month') bits.push(per.per.toFixed(2));
                      return (
                        <tr key={r.key}>
                          <td>
                            <input
                              className="lb-i-name"
                              value={r.name}
                              placeholder="What is it?"
                              onChange={(e) => patchRow(r.key, { name: e.target.value })}
                            />
                          </td>
                          <td className="r">
                            <input
                              className="lb-i-in"
                              type="number"
                              min="0"
                              inputMode="numeric"
                              value={r.qty}
                              onChange={(e) => patchRow(r.key, { qty: e.target.value })}
                            />
                          </td>
                          <td className="r">
                            <input
                              className="lb-i-in"
                              type="number"
                              min="0"
                              inputMode="numeric"
                              value={r.unit_php}
                              placeholder="0"
                              onChange={(e) => patchRow(r.key, { unit_php: e.target.value })}
                            />
                          </td>
                          <td>
                            <select
                              value={r.basis}
                              onChange={(e) => patchRow(r.key, { basis: e.target.value })}
                            >
                              {LIVING_BASES.map((b) => (
                                <option key={b.key} value={b.key}>
                                  {b.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="r lb-i-total">
                            {line.toLocaleString('en-US')}
                            <span className="lb-i-calc">{bits.join(' × ')}</span>
                          </td>
                          <td className="r">
                            <button
                              className="lb-i-del"
                              aria-label={`Remove ${r.name || 'item'}`}
                              disabled={rows.length <= 1}
                              onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="lb-i-sum">
                      <td colSpan={4}>{cat.name} — every month</td>
                      <td className="r">{fmtPhp(itemTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <button className="lb-additem" onClick={() => setRows((rs) => [...rs, blankItem()])}>
                + Add item
              </button>
            </>
          )}
        </div>

        <div className="lb-modal-ft">
          <span className="lb-ft-note">
            {mode === 'detail'
              ? 'Rounded per line, then summed — the same figure every month.'
              : 'Saved as a single amount for this month.'}
          </span>
          <button className="lb-btn lb-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="lb-btn lb-btn-primary"
            disabled={busy || (mode === 'detail' && namedItems.length === 0)}
            onClick={() =>
              onSave(
                mode === 'detail' ? 'items' : 'simple',
                mode === 'detail' ? namedItems : simpleTotal
              )
            }
          >
            Save budget
          </button>
        </div>
      </div>
    </Scrim>
  );
}

function Scrim({ children, onClose, labelledBy }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="lb-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="lb-scrim-inner">
        {children}
      </div>
    </div>
  );
}
