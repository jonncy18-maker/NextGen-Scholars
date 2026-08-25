'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { EXPENSE_CATS } from '../constants.js';
import { WEEKDAYS, SCHEDULE_MODES, occurrences, splitAmount } from '../recurrence.js';
import { planPushToFinances, confirmPushToFinances } from '../api-writer.js';

// Mentor-only: turn a scholar's living-budget plan for one month into dated
// rows in the PROGRAM expense ledger.
//
// Two stages, deliberately separated the same way the Tier 4 agent separates
// plan from confirm (lib/ai/agent.js): the AI proposes a category mapping and
// stops; nothing is written until the mentor has both approved the mapping AND
// supplied when each outflow actually happens. The AI never picks a date.
//
// ── This REPLACES, it does not add ─────────────────────────────────────────
// The rows written here supersede the lump-sum allowance expense for the month
// (and any earlier push of the same month). That is not a nicety — summing her
// itemised categories into `expenses` ON TOP of the allowance row double-counts
// every peso and inflates the bucket totals the public profile pages publish.
// See db/living_budget.sql. The server enforces it; this UI shows what will go.

function fmtPhp(n) {
  return '₱' + Math.round(Number(n) || 0).toLocaleString('en-US');
}

function monthLabel(key) {
  const [y, m] = String(key).split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function shortDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Every line starts monthly-on-the-1st: a definite, obviously-editable default
// beats an empty date field the mentor has to fill 13 times before the Push
// button will even enable.
function defaultSchedule() {
  return { mode: 'monthly', dayOfMonth: 1, weekday: 5, date: '' };
}

export function PushToFinancesModal({ scholarKey, month, onClose, onPushed }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [plan, setPlan] = useState(null);
  const [lines, setLines] = useState([]);
  const [stage, setStage] = useState('map'); // 'map' | 'dates'
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    planPushToFinances({ scholar: scholarKey, month })
      .then((res) => {
        if (cancelled) return;
        setPlan(res);
        setLines(
          (res.rows || []).map((r) => ({
            ...r,
            include: true,
            item: r.name,
            schedule: defaultSchedule(),
          }))
        );
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not read this budget.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scholarKey, month]);

  const included = useMemo(() => lines.filter((l) => l.include), [lines]);
  const total = useMemo(() => included.reduce((s, l) => s + l.amount_php, 0), [included]);

  // A line whose schedule resolves to no dates can't be written — the server
  // rejects the whole request rather than silently dropping it, so block here.
  const unscheduled = useMemo(
    () => included.filter((l) => occurrences(month, l.schedule).length === 0),
    [included, month]
  );

  function patch(id, fields) {
    setLines((ls) => ls.map((l) => (l.category_id === id ? { ...l, ...fields } : l)));
  }

  async function push() {
    setBusy(true);
    try {
      const res = await confirmPushToFinances({
        scholar: scholarKey,
        month,
        sem: plan?.sem,
        lines: included.map((l) => ({
          category_id: l.category_id,
          item: l.item,
          cat: l.cat,
          amount_php: l.amount_php,
          schedule: l.schedule,
        })),
      });
      setResult(res);
      onPushed?.();
    } catch (err) {
      setError(err?.message || 'Could not push these expenses.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="lb-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="ptf-title" className="lb-scrim-inner">
        <div className="lb-modal is-wide">
          <div className="lb-modal-hd">
            <h3 id="ptf-title">Push to Finances</h3>
            <span className="lb-modal-sub">
              {plan?.scholarName ? `${plan.scholarName} · ` : ''}
              {monthLabel(month)}
              {stage === 'dates' ? ' · when did the money leave?' : ' · check the mapping'}
            </span>
          </div>

          <div className="lb-modal-body">
            {error && <div className="lb-error">{error}</div>}

            {result ? (
              <div className="ptf-done">
                <div className="ptf-done-big">{result.inserted} expenses written</div>
                <div className="ptf-done-sub">
                  {fmtPhp(result.total)} into the program ledger for {monthLabel(month)}.
                  {result.replacedAllowance
                    ? ' The single lump-sum allowance row for this month was replaced, so nothing is double-counted.'
                    : ''}
                </div>
              </div>
            ) : loading ? (
              <div className="lb-loading">Reading the budget and mapping categories…</div>
            ) : !lines.length ? (
              <div className="lb-empty">
                Nothing budgeted for {monthLabel(month)} yet — there is nothing to push.
              </div>
            ) : stage === 'map' ? (
              <>
                <div className="ptf-note">
                  {plan?.aiUsed
                    ? 'Claude proposed a sponsor category for each line. Change anything that looks wrong — nothing is written until you confirm.'
                    : 'Mapped by category group (the AI was unavailable). Change anything that looks wrong — nothing is written until you confirm.'}
                </div>

                {(plan?.replaces?.allowance || plan?.replaces?.pushed?.length > 0) && (
                  <div className="ptf-replaces">
                    <b>This will replace, not add to, existing rows.</b>
                    {plan.replaces.allowance && (
                      <div>
                        · The lump-sum allowance expense for this month (
                        {fmtPhp(plan.replaces.allowance.amount)}) will be removed — these itemised
                        rows take its place.
                      </div>
                    )}
                    {plan.replaces.pushed?.length > 0 && (
                      <div>
                        · {plan.replaces.pushed.length} row
                        {plan.replaces.pushed.length === 1 ? '' : 's'} from an earlier push of this
                        month will be removed first.
                      </div>
                    )}
                  </div>
                )}

                <div className="lb-items-scroll">
                  <table className="lb-items ptf-table">
                    <thead>
                      <tr>
                        <th>Push</th>
                        <th>Her category</th>
                        <th>Appears in Finances as</th>
                        <th>Sponsor category</th>
                        <th className="r">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.category_id} className={l.include ? undefined : 'is-skipped'}>
                          <td>
                            <input
                              type="checkbox"
                              checked={l.include}
                              aria-label={`Include ${l.name}`}
                              onChange={(e) => patch(l.category_id, { include: e.target.checked })}
                            />
                          </td>
                          <td>
                            <div className="ptf-cat-name">{l.name}</div>
                            <div className="ptf-cat-why">{l.reason}</div>
                          </td>
                          <td>
                            <input
                              className="lb-i-name"
                              value={l.item}
                              onChange={(e) => patch(l.category_id, { item: e.target.value })}
                            />
                          </td>
                          <td>
                            <select
                              value={l.cat}
                              onChange={(e) => patch(l.category_id, { cat: e.target.value })}
                            >
                              {EXPENSE_CATS.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="r lb-i-total">{fmtPhp(l.amount_php)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="lb-i-sum">
                        <td colSpan={4}>
                          {included.length} of {lines.length} lines
                        </td>
                        <td className="r">{fmtPhp(total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            ) : (
              <>
                <div className="ptf-note">
                  Say when each outflow happens. <b>Monthly</b> writes one row on the day you pick.{' '}
                  <b>Weekly</b> writes one row per weekday in the month, splitting the amount so the
                  month still totals the same.
                </div>

                {included.map((l) => {
                  const dates = occurrences(month, l.schedule);
                  const parts = splitAmount(l.amount_php, dates.length);
                  return (
                    <div key={l.category_id} className="ptf-sched">
                      <div className="ptf-sched-hd">
                        <span className="ptf-sched-name">{l.item}</span>
                        <span className="ptf-sched-cat">{l.cat}</span>
                        <span className="ptf-sched-amt">{fmtPhp(l.amount_php)}</span>
                      </div>

                      <div className="ptf-sched-row">
                        <select
                          aria-label={`How often for ${l.item}`}
                          value={l.schedule.mode}
                          onChange={(e) =>
                            patch(l.category_id, {
                              schedule: { ...l.schedule, mode: e.target.value },
                            })
                          }
                        >
                          {SCHEDULE_MODES.map((m) => (
                            <option key={m.key} value={m.key}>
                              {m.label} — {m.hint}
                            </option>
                          ))}
                        </select>

                        {l.schedule.mode === 'monthly' && (
                          <label className="ptf-sched-field">
                            <span>Day of month</span>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              value={l.schedule.dayOfMonth}
                              onChange={(e) =>
                                patch(l.category_id, {
                                  schedule: { ...l.schedule, dayOfMonth: Number(e.target.value) },
                                })
                              }
                            />
                          </label>
                        )}

                        {l.schedule.mode === 'weekly' && (
                          <label className="ptf-sched-field">
                            <span>Every</span>
                            <select
                              value={l.schedule.weekday}
                              onChange={(e) =>
                                patch(l.category_id, {
                                  schedule: { ...l.schedule, weekday: Number(e.target.value) },
                                })
                              }
                            >
                              {WEEKDAYS.map((w) => (
                                <option key={w.key} value={w.key}>
                                  {w.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}

                        {l.schedule.mode === 'once' && (
                          <label className="ptf-sched-field">
                            <span>Date</span>
                            <input
                              type="date"
                              value={l.schedule.date}
                              onChange={(e) =>
                                patch(l.category_id, {
                                  schedule: { ...l.schedule, date: e.target.value },
                                })
                              }
                            />
                          </label>
                        )}
                      </div>

                      <div className="ptf-sched-preview">
                        {dates.length === 0 ? (
                          <span className="ptf-sched-missing">
                            Pick a date to include this line.
                          </span>
                        ) : (
                          dates.map((d, i) => (
                            <span key={d} className="ptf-chip">
                              {shortDate(d)} · {fmtPhp(parts[i])}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div className="lb-modal-ft">
            {result ? (
              <>
                <span className="lb-ft-note">
                  Finances now shows these rows for {monthLabel(month)}.
                </span>
                <button className="lb-btn lb-btn-primary" onClick={onClose}>
                  Done
                </button>
              </>
            ) : stage === 'map' ? (
              <>
                <span className="lb-ft-note">
                  Nothing is written yet — you'll set the dates next.
                </span>
                <button className="lb-btn lb-btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="lb-btn lb-btn-primary"
                  disabled={loading || included.length === 0}
                  onClick={() => setStage('dates')}
                >
                  Next — set dates →
                </button>
              </>
            ) : (
              <>
                <span className="lb-ft-note">
                  {unscheduled.length > 0
                    ? `${unscheduled.length} line${unscheduled.length === 1 ? '' : 's'} still needs a date.`
                    : `Writes ${fmtPhp(total)} across ${included.reduce((n, l) => n + occurrences(month, l.schedule).length, 0)} rows.`}
                </span>
                <button className="lb-btn lb-btn-ghost" onClick={() => setStage('map')}>
                  ← Back
                </button>
                <button
                  className="lb-btn lb-btn-primary"
                  disabled={busy || included.length === 0 || unscheduled.length > 0}
                  onClick={push}
                >
                  {busy ? 'Pushing…' : 'Push to Finances'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
