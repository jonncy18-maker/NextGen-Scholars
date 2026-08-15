import React, { useState } from 'react';
import { api } from '../lib/api.js';
import {
  createLivingCategories, updateLivingCategory, deleteLivingCategory, setLivingPlan,
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

const kindLabel = k => LIVING_KINDS.find(x => x.key === k)?.label ?? k;
const rollupLabel = r => LIVING_ROLLUPS.find(x => x.key === r)?.label ?? r;

// Turn one op into a sentence a person can check at a glance. Anything the
// user can't read, they can't meaningfully approve.
function describe(op, nameOf) {
  switch (op.op) {
    case 'create_category': {
      const bits = [`Add "${op.name}"`, `as ${kindLabel(op.kind).toLowerCase()}`, `in ${rollupLabel(op.rollup)}`];
      if (op.kind === 'sinking' && op.sinking_target_php && op.sinking_months) {
        bits.push(`— saving ${php(op.sinking_target_php)} over ${op.sinking_months} months (${php(op.sinking_target_php / op.sinking_months)}/mo)`);
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
        changes.push(op.sinking_target_php == null ? 'clear the total cost' : `set total cost ${php(op.sinking_target_php)}`);
      }
      if ('sinking_months' in op) {
        changes.push(op.sinking_months == null ? 'clear the months' : `due in ${op.sinking_months} months`);
      }
      return `${nameOf(op.id)}: ${changes.join(', ')}`;
    }
    case 'archive_category':
      return `Remove "${nameOf(op.id)}"`;
    case 'set_plan':
      return `Set ${nameOf(op.category_id)} to ${php(op.planned_php)}`;
    default:
      return op.op;
  }
}

export function BudgetAskPanel({ scholarKey, month, categories, onApplied }) {
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  const nameOf = (id) => categories.find(c => String(c.id) === String(id))?.name ?? 'that category';

  async function ask(e) {
    e.preventDefault();
    const q = text.trim();
    if (!q || thinking) return;

    setThinking(true);
    setError(null);
    setAnswer(null);
    setProposal(null);

    try {
      const res = await api.post('/ask-budget', { scholar: scholarKey, month, text: q });
      if (res.kind === 'proposal') setProposal(res);
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

    try {
      // Creates run first so a set_plan on a brand-new category has an id to
      // attach to. The model refers to new categories by name, not id (it
      // can't know an id that doesn't exist yet), so the create's own
      // planned_php carries the amount instead.
      for (const op of proposal.ops.filter(o => o.op === 'create_category')) {
        const rows = await createLivingCategories(scholarKey, {
          name: op.name,
          kind: op.kind,
          rollup: op.rollup,
          sinking_target_php: op.sinking_target_php,
          sinking_months: op.sinking_months,
        });
        const created = Array.isArray(rows) ? rows[0] : rows;
        if (created?.id && op.planned_php > 0) {
          await setLivingPlan({ month, category_id: created.id, planned_php: op.planned_php });
        }
      }

      for (const op of proposal.ops) {
        if (op.op === 'update_category') {
          const { op: _op, id, ...fields } = op;
          await updateLivingCategory(id, fields);
        } else if (op.op === 'archive_category') {
          await deleteLivingCategory(op.id);
        } else if (op.op === 'set_plan') {
          await setLivingPlan({ month, category_id: op.category_id, planned_php: op.planned_php });
        }
      }

      setProposal(null);
      setAnswer('Done — your budget has been updated.');
      onApplied?.();
    } catch (err) {
      setError(err?.message || 'Some changes could not be applied.');
      // Reload regardless: a partial apply means what's on screen is stale.
      onApplied?.();
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="lb-ask">
      <h3 className="lb-ask-title">Ask about your budget</h3>
      <p className="lb-ask-sub">
        You can ask a question, or just say what you want changed — "add ₱300 for haircuts",
        "registration is ₱2,400 a year", "rename Food to Groceries".
      </p>

      <form className="lb-ask-form" onSubmit={ask}>
        <input
          className="lb-ask-input"
          placeholder="Type your question or change…"
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={thinking || applying}
        />
        <button type="submit" disabled={thinking || applying || !text.trim()}>
          {thinking ? '…' : 'Ask'}
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
              {applying ? 'Applying…' : `Apply ${proposal.ops.length} change${proposal.ops.length === 1 ? '' : 's'}`}
            </button>
            <button className="lb-discard" onClick={() => setProposal(null)} disabled={applying}>
              Discard
            </button>
          </div>
          <div className="lb-proposal-note">Nothing changes until you tap Apply.</div>
        </div>
      )}
    </section>
  );
}
