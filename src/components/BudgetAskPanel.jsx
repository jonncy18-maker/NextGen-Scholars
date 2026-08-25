import React, { useState } from 'react';
import { api } from '../lib/api.js';
import {
  createLivingCategories,
  updateLivingCategory,
  deleteLivingCategory,
  setLivingPlan,
  moveLivingMonth,
} from '../api-writer.js';
import { LIVING_KINDS, LIVING_ROLLUPS } from '../constants.js';

// Ask-anything panel for the living budget. Everything the page can do by
// hand, it can do by sentence: add a category, rename one, change a type, set
// an amount, set up a sinking fund, remove something.
//
// Nothing is applied without approval. /api/ask-budget returns either a plain
// answer or a PROPOSAL — a list of operations the model suggests — and this
// component renders them in plain language behind an Apply button. Applying
// calls the same api-writer functions the buttons on this page call, so the
// server re-checks ownership on every write and the AI path has no privileges
// the manual path lacks.

function php(n) {
  return '₱' + Math.round(Number(n) || 0).toLocaleString('en-US');
}

const kindLabel = (k) => LIVING_KINDS.find((x) => x.key === k)?.label ?? k;
const rollupLabel = (r) => LIVING_ROLLUPS.find((x) => x.key === r)?.label ?? r;

// Turn one op into a sentence a person can check at a glance. Anything the
// user can't read, they can't meaningfully approve.
function describe(op, nameOf) {
  switch (op.op) {
    case 'create_category': {
      const bits = [
        `Add "${op.name}"`,
        `as ${kindLabel(op.kind).toLowerCase()}`,
        `in ${rollupLabel(op.rollup)}`,
      ];
      if (op.kind === 'sinking' && op.sinking_target_php) {
        bits.push(
          `— ${php(op.sinking_target_php)} one-time${op.sinking_due_month ? `, due ${op.sinking_due_month}` : ''}`
        );
      }
      if (op.planned_php > 0) bits.push(`— ${php(op.planned_php)} this month`);
      return bits.join(' ');
    }
    case 'update_category': {
      const changes = [];
      if (op.name) changes.push(`rename to "${op.name}"`);
      if (op.kind) changes.push(`make it ${kindLabel(op.kind).toLowerCase()}`);
      if (op.rollup) changes.push(`move to ${rollupLabel(op.rollup)}`);
      if ('sinking_target_php' in op) {
        changes.push(
          op.sinking_target_php == null
            ? 'clear the total cost'
            : `set total cost ${php(op.sinking_target_php)}`
        );
      }
      if ('sinking_due_month' in op) {
        changes.push(
          op.sinking_due_month == null ? 'clear the due month' : `due ${op.sinking_due_month}`
        );
      }
      return `${nameOf(op.id)}: ${changes.join(', ')}`;
    }
    case 'archive_category':
      return `Remove "${nameOf(op.id)}"`;
    case 'set_plan':
      // The month is spelled out whenever it isn't the one on screen. A change
      // landing in a month she isn't looking at is invisible after the fact,
      // so it has to be visible before she approves it.
      return `Set ${nameOf(op.category_id)} to ${php(op.planned_php)}${op.month ? ` in ${monthLabel(op.month)}` : ''}`;
    case 'flow_plan':
      return `Set ${nameOf(op.category_id)} to ${php(op.planned_php)} every month${op.from_month ? ` from ${monthLabel(op.from_month)}` : ''} through ${monthLabel(op.through_month)}`;
    case 'push_to_finances':
      return `Open the Push to Finances review for ${monthLabel(op.month)} — you'll set the dates there before anything is written`;
    case 'move_month':
      return op.mode === 'copy'
        ? `Copy the whole ${monthLabel(op.from_month)} budget into ${monthLabel(op.to_month)} (${monthLabel(op.from_month)} stays as it is)`
        : `Move the whole ${monthLabel(op.from_month)} budget to ${monthLabel(op.to_month)} — ${monthLabel(op.from_month)} is left empty`;
    default:
      return op.op;
  }
}

function monthLabel(key) {
  if (!key) return '';
  const [y, m] = String(key).split('-').map(Number);
  if (!y || !m) return String(key);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Every month from `from` through `to` inclusive, capped so a mistyped year
// can't fan out hundreds of writes — the same 24-month ceiling the manual
// flow-through control enforces in LivingBudget.jsx.
function monthsFromThrough(from, to) {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const span = (ty - fy) * 12 + (tm - fm);
  if (!Number.isFinite(span) || span < 0 || span > 23) return null;
  return Array.from({ length: span + 1 }, (_, i) => {
    const d = new Date(fy, fm - 1 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

export function BudgetAskPanel({
  scholarKey,
  month,
  categories,
  onApplied,
  isMentor,
  onPushToFinances,
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  const nameOf = (id) =>
    categories.find((c) => String(c.id) === String(id))?.name ?? 'that category';

  async function ask(e) {
    e.preventDefault();
    const q = text.trim();
    if (!q || thinking) return;

    setThinking(true);
    setError(null);
    setAnswer(null);
    setProposal(null);

    try {
      // A proposal on screen turns the next message into a CORRECTION of it,
      // not a fresh request. Without this, fixing one wrong line means
      // discarding the whole proposal and retyping the request from scratch
      // with the fix worked into the original sentence — which is exactly
      // when people give up and do it by hand instead.
      const res = await api.post('/ask-budget', {
        scholar: scholarKey,
        month,
        text: q,
        ...(proposal ? { pending: { summary: proposal.summary, ops: proposal.ops } } : {}),
      });
      // Freeze the month the proposal was generated against. She can page to a
      // different month between Ask and Apply, and writing September's changes
      // into October is both wrong and invisible.
      if (res.kind === 'proposal') setProposal({ ...res, month: proposal?.month || month });
      else setAnswer(res.text);
      setText('');
    } catch (err) {
      setError(err?.message || 'Could not reach the assistant.');
    } finally {
      setThinking(false);
    }
  }

  async function apply() {
    if (!proposal || applying) return;
    setApplying(true);
    setError(null);
    const applyMonth = proposal.month || month;
    let pushAfter = null;

    try {
      // Creates run first so a set_plan on a brand-new category has an id to
      // attach to. The model refers to new categories by name, not id (it
      // can't know an id that doesn't exist yet), so the create's own
      // planned_php carries the amount instead.
      for (const op of proposal.ops.filter((o) => o.op === 'create_category')) {
        const rows = await createLivingCategories(scholarKey, {
          name: op.name,
          kind: op.kind,
          rollup: op.rollup,
          sinking_target_php: op.sinking_target_php,
        });
        const created = Array.isArray(rows) ? rows[0] : rows;
        // The create endpoint doesn't take a due month (it's set via the same
        // PATCH the manual Build-tab editor uses), so a fresh sinking category
        // needs a follow-up update to actually persist one.
        if (created?.id && op.sinking_due_month) {
          await updateLivingCategory(created.id, { sinking_due_month: op.sinking_due_month });
        }
        if (created?.id && op.planned_php > 0) {
          await setLivingPlan({
            month: applyMonth,
            category_id: created.id,
            planned_php: op.planned_php,
          });
        }
      }

      for (const op of proposal.ops) {
        if (op.op === 'update_category') {
          const { op: _op, id, ...fields } = op;
          await updateLivingCategory(id, fields);
        } else if (op.op === 'archive_category') {
          await deleteLivingCategory(op.id);
        } else if (op.op === 'set_plan') {
          // op.month wins when the model named a specific one; otherwise the
          // month the proposal was generated against (frozen at Ask time).
          await setLivingPlan({
            month: op.month || applyMonth,
            category_id: op.category_id,
            planned_php: op.planned_php,
          });
        } else if (op.op === 'flow_plan') {
          const months = monthsFromThrough(op.from_month || applyMonth, op.through_month);
          if (!months) throw new Error('That flow spans more than 24 months — narrow the range.');
          for (const m of months) {
            await setLivingPlan({
              month: m,
              category_id: op.category_id,
              planned_php: op.planned_php,
            });
          }
        } else if (op.op === 'move_month') {
          await moveLivingMonth({
            scholar: scholarKey,
            from: op.from_month,
            to: op.to_month,
            mode: op.mode,
          });
        } else if (op.op === 'push_to_finances') {
          // Deliberately opens the review modal rather than writing. The push
          // needs a real outflow DATE per line, which is a fact about the
          // world the model cannot know — and it deletes the month's existing
          // rows, so it is the last thing that should happen on a one-line
          // say-so. The AI gets you to the right screen; you still confirm.
          pushAfter = op.month || applyMonth;
        }
      }

      setProposal(null);
      setAnswer(
        pushAfter
          ? 'Done — opening the Push to Finances review so you can set the dates.'
          : 'Done — your budget has been updated.'
      );
      onApplied?.();
      if (pushAfter) onPushToFinances?.(pushAfter);
    } catch (err) {
      setError(
        (err?.message || 'Some changes could not be applied.') +
          ' Some changes may have gone through — check the list above and ask again for anything missing.'
      );
      // Clear the proposal even though it only partly applied. Leaving it on
      // screen with a live Apply button invites a retry that replays the ops
      // that already succeeded: creates and amounts are idempotent, but a
      // repeated archive hits an already-removed row, 404s, and masks the
      // original error behind a different one.
      setProposal(null);
      // Reload regardless: a partial apply means what's on screen is stale.
      onApplied?.();
    } finally {
      setApplying(false);
    }
  }

  // Collapsed by default into a launcher pinned to the viewport corner.
  //
  // This panel used to render inline at the bottom of the page. Moving it out
  // of the Build tab made it reachable from all three tabs in principle, but
  // in practice it sat below a full screen of dashboard — so on the tab people
  // actually land on, the assistant was invisible and looked absent. An inline
  // block cannot fix that: any page long enough to scroll will bury it. A
  // fixed launcher is visible from every tab at every scroll position.
  if (!open) {
    return (
      <button
        type="button"
        className={`lb-ask-fab${proposal ? ' has-pending' : ''}`}
        onClick={() => setOpen(true)}
        aria-expanded="false"
        title={proposal ? 'You have changes waiting for approval' : 'Ask about this budget'}
      >
        <span className="lb-ask-fab-badge">AI</span>
        <span className="lb-ask-fab-label">
          {/* Closing the dock keeps an un-applied proposal in state. Without
              saying so, those pending changes are silently stranded behind a
              button that looks like a fresh start. */}
          {proposal
            ? `${proposal.ops.length} change${proposal.ops.length === 1 ? '' : 's'} to review`
            : 'Ask about this budget'}
        </span>
      </button>
    );
  }

  return (
    <section className="lb-ask is-docked">
      <div className="lb-ask-hd">
        <span className="lb-ask-fab-badge">AI</span>
        <h3 className="lb-ask-title">Ask about this budget</h3>
        <button
          type="button"
          className="lb-ask-close"
          onClick={() => setOpen(false)}
          aria-label="Close the assistant"
        >
          ×
        </button>
      </div>

      <p className="lb-ask-sub">
        Ask a question, or just say what you want changed — "add ₱300 for haircuts", "make rent
        4,500 every month through December", "I put all this in August but it should start in
        September"
        {isMentor ? ', "push September to finances"' : ''}.
      </p>

      <form className="lb-ask-form" onSubmit={ask}>
        <input
          className="lb-ask-input"
          placeholder={
            proposal ? 'Not quite right? Say what to fix…' : 'Type your question or change…'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={thinking || applying}
        />
        <button type="submit" disabled={thinking || applying || !text.trim()}>
          {thinking ? '…' : proposal ? 'Revise' : 'Ask'}
        </button>
      </form>

      {error && <div className="lb-ask-error">{error}</div>}

      {answer && <div className="lb-ask-answer">{answer}</div>}

      {proposal && (
        <div className="lb-proposal">
          <div className="lb-proposal-summary">{proposal.summary}</div>
          <ul className="lb-proposal-list">
            {proposal.ops.map((op, i) => (
              <li key={i}>{describe(op, nameOf)}</li>
            ))}
          </ul>
          <div className="lb-proposal-actions">
            <button className="lb-apply" onClick={apply} disabled={applying}>
              {applying
                ? 'Applying…'
                : `Apply ${proposal.ops.length} change${proposal.ops.length === 1 ? '' : 's'}`}
            </button>
            <button className="lb-discard" onClick={() => setProposal(null)} disabled={applying}>
              Discard
            </button>
          </div>
          <div className="lb-proposal-note">
            Nothing changes until you tap Apply. If something above is wrong, type the correction in
            the box and tap Revise — you don't have to start over.
          </div>
        </div>
      )}
    </section>
  );
}
