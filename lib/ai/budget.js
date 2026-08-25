// Living-budget AI resolver — gives the assistant every capability the
// /budget/:scholar UI offers by hand: read the plan, add/rename/retype
// categories, set amounts, set up a sinking fund, archive things.
//
// ── The model never writes ──────────────────────────────────────────────────
// Same contract as action.js and expense-edit.js: Claude only PROPOSES a list
// of operations. The client renders them for confirmation and applies them
// through the existing /api/living/** write routes, which re-check ownership
// server-side. So the blast radius of a bad generation is "a proposal the user
// declines", not a mutated database, and every write still passes the same
// authorization it would from a button press.
//
// Reads are resolved deterministically where possible (no LLM, no cost, no
// hallucinated arithmetic) — the same Tier 1 idea as tier1.js. Only genuinely
// open-ended questions and all write intents reach Claude — the AI brain for
// this authenticated, scholar-owned route (see CLAUDE.md "AI layer").

import { LIVING_KINDS, LIVING_ROLLUPS } from '../../src/constants.js';
import { callClaude, textFromMessage } from './claude.js';

// Derived from the shared constants rather than re-listed here. Re-inlining
// them is precisely the EXPENSE_CATS mistake CLAUDE.md documents: a fourth
// copy means a new rollup silently fails validation in whichever copy someone
// forgets to update.
const KINDS = LIVING_KINDS.map((k) => k.key);
const ROLLUPS = LIVING_ROLLUPS.map((r) => r.key);

const OPS = [
  'create_category',
  'update_category',
  'archive_category',
  'set_plan',
  // Month-aware ops. Everything above acts on the month she's viewing; these
  // three exist because the most common real correction is about the WRONG
  // MONTH, not a wrong amount — a whole month budgeted against August when
  // she meant September. Fixing that by hand is a dozen edits, so it has to
  // be sayable in one sentence.
  'flow_plan',
  'move_month',
  // Mentor-only. Does NOT perform the push — it opens the review modal, which
  // is where outflow dates get set and where the destructive replace is
  // confirmed. Filtered out entirely for a scholar caller in sanitizeOps.
  'push_to_finances',
];

function php(n) {
  return '₱' + Math.round(Number(n) || 0).toLocaleString('en-US');
}

// A negative total cost renders as nonsense ("save -₱400"). planned_php was
// already clamped; this wasn't.
function clampNonNegative(n) {
  return n === null ? null : Math.max(0, n);
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Verbs that mean "change something". `fill` included because "fill in food
// with 2000" is a very natural way to set an amount.
const WRITE_VERBS =
  /\b(set|add|change|rename|remove|delete|drop|make|create|put|fill|raise|lower|increase|decrease|update|bump)\b/i;
const QUESTION_START =
  /^(what|what's|whats|how|which|when|why|who|is|are|do|does|did|can|could|should|show|list|tell)\b/i;

// The read matchers below are bare substring tests, which makes them greedy:
// "set my food TOTAL to 3000" contains "total", "FILL IN food with 2000"
// contains "fill in". Without this check those write requests get answered
// with a read and nothing changes — the assistant looks like it ignored her.
//
// A question that merely happens to contain a verb ("how much should I set
// aside for tires?") stays a read, unless it also carries a figure.
export function looksLikeWriteIntent(text) {
  const t = String(text || '').trim();
  if (!WRITE_VERBS.test(t)) return false;
  if (QUESTION_START.test(t) && !/\d/.test(t)) return false;
  return true;
}

// ── Tier 1: deterministic reads ─────────────────────────────────────────────
// Returns a string answer, or null to escalate. Arithmetic is done in JS on
// real rows rather than asked of a language model, which is both free and
// correct — an LLM summing twelve peso amounts is a coin flip we don't need.
export function resolveBudgetRead(text, { categories, plan, month }) {
  const q = String(text || '')
    .toLowerCase()
    .trim();
  if (!q) return null;

  const active = categories.filter((c) => !c.archived_at);
  const amountFor = (c) => Number(plan[c.id]) || 0;
  const total = active.reduce((s, c) => s + amountFor(c), 0);

  const asks = (...words) => words.some((w) => q.includes(w));

  // "what's my total", "how much do I need", "what does it add up to"
  if (asks('total', 'altogether', 'add up', 'sum', 'how much do i need', 'how much will i need')) {
    if (active.length === 0) return `There's nothing in the ${month} budget yet.`;
    return `Your ${month} budget totals ${php(total)} across ${active.length} categories.`;
  }

  // "what am I saving for" / non-recurring costs
  if (
    asks(
      'saving for',
      'sinking',
      'set aside',
      'putting aside',
      'non-recurring',
      'one-time',
      'one time'
    )
  ) {
    const sinking = active.filter((c) => c.kind === 'sinking');
    if (sinking.length === 0) {
      return "No non-recurring costs set up yet — those are for costs that don't arrive every month, like registration or insurance.";
    }
    const lines = sinking.map((c) => {
      if (!c.sinking_target_php) return `• ${c.name} — no total cost set yet`;
      const due = c.sinking_due_month ? `, due ${c.sinking_due_month}` : ' (no due month set)';
      return `• ${c.name} — ${php(c.sinking_target_php)}${due}`;
    });
    return `Your non-recurring costs:\n${lines.join('\n')}`;
  }

  // "what's my biggest expense"
  if (asks('biggest', 'largest', 'most expensive', 'highest')) {
    const withAmounts = active.filter((c) => amountFor(c) > 0);
    if (withAmounts.length === 0) return `Nothing in the ${month} budget has an amount yet.`;
    const top = withAmounts.sort((a, b) => amountFor(b) - amountFor(a))[0];
    const pct = total > 0 ? Math.round((amountFor(top) / total) * 100) : 0;
    return `${top.name}, at ${php(amountFor(top))} — that's ${pct}% of your ${php(total)} budget.`;
  }

  // "what categories do I have" / "list"
  if (asks('what categories', 'list my categories', 'which categories', 'what am i budgeting')) {
    if (active.length === 0) return 'You have no categories yet.';
    const lines = active.map(
      (c) => `• ${c.name} — ${amountFor(c) ? php(amountFor(c)) : 'not set'}`
    );
    return `Your ${month} categories:\n${lines.join('\n')}`;
  }

  // "what haven't I filled in" — match on the verb alone rather than a phrase.
  // A phrase like "haven't filled" misses the far more natural "haven't I
  // filled in", where the pronoun sits between the two words.
  if (asks('blank', 'empty', 'not set', 'filled in', 'fill in', 'filled out', 'missing amount')) {
    const blanks = active.filter((c) => amountFor(c) === 0);
    if (blanks.length === 0) return 'Every category has an amount — nothing left blank.';
    return `Still blank: ${blanks.map((c) => c.name).join(', ')}.`;
  }

  // "how much for food" — direct category lookup by name mention
  const named = active.find((c) => q.includes(c.name.toLowerCase()));
  if (named && asks('how much', 'what is', "what's", 'budgeted for', 'set for')) {
    const amt = amountFor(named);
    const extra =
      named.kind === 'sinking' && named.sinking_target_php
        ? ` (a non-recurring cost — ${php(named.sinking_target_php)} total${named.sinking_due_month ? `, due ${named.sinking_due_month}` : ''})`
        : '';
    return amt
      ? `${named.name} is set to ${php(amt)} for ${month}${extra}.`
      : `${named.name} has no amount set for ${month} yet${extra}.`;
  }

  return null; // escalate
}

// ── Compact state for the model ─────────────────────────────────────────────
// Ids are included because every write op refers to a category by id, never by
// name — the same reason living_plan keys on category_id.
function stateForPrompt({ categories, plan, month }) {
  return {
    month,
    // Without this the model has no anchor for "September" or "next month" and
    // guesses a year — usually its training-cutoff year, which silently writes
    // the plan into a month twelve months away.
    today: new Date().toISOString().slice(0, 10),
    categories: categories
      .filter((c) => !c.archived_at)
      .map((c) => ({
        id: String(c.id),
        name: c.name,
        kind: c.kind,
        rollup: c.rollup,
        sinking_target_php: c.sinking_target_php == null ? null : Number(c.sinking_target_php),
        sinking_due_month: c.sinking_due_month ?? null,
        planned_php: Number(plan[c.id]) || 0,
      })),
    archived: categories
      .filter((c) => c.archived_at)
      .map((c) => ({ id: String(c.id), name: c.name })),
  };
}

const SYSTEM = `You help a Filipino nursing student manage her personal monthly living budget in a mentorship program. She lives in a dorm in Cebu and rides a motorcycle to class and clinical rotations. Amounts are Philippine pesos.

You do NOT change anything yourself. You propose operations that she reviews and approves.

Category "kind" means:
- fixed: same amount every month (dorm rent, wifi)
- variable: changes month to month (food, fuel)
- sinking: a ONE-TIME cost, not billed monthly (annual registration, insurance, tires). A sinking category needs sinking_target_php (the whole cost) and, when she knows it, sinking_due_month ("YYYY-MM") for the month it actually lands. It does NOT get spread across months — it shows as ₱0 every month except the one it's due, when it shows the full amount.

Category "rollup" must be one of: housing, food, transport, school, personal, savings.

Return ONLY minified JSON, no markdown fence, in this shape:
{"summary":"one short sentence in plain language","ops":[...]}

Valid ops:
{"op":"create_category","name":"...","kind":"...","rollup":"...","sinking_target_php":null,"sinking_due_month":null,"planned_php":0}
{"op":"update_category","id":"...","name":"...","kind":"...","rollup":"...","sinking_target_php":null,"sinking_due_month":null}
{"op":"archive_category","id":"..."}
{"op":"set_plan","category_id":"...","planned_php":0,"month":null}
{"op":"flow_plan","category_id":"...","planned_php":0,"from_month":null,"through_month":"YYYY-MM"}
{"op":"move_month","from_month":"YYYY-MM","to_month":"YYYY-MM","mode":"move"}
{"op":"push_to_finances","month":"YYYY-MM"}

Rules:
- Refer to existing categories by their id from the state. Never invent an id.
- For update_category include ONLY the fields being changed, plus id.
- If she gives a yearly or irregular cost, make it a sinking category with sinking_target_php as the full amount, not divided by anything. Set sinking_due_month if she said or implied when it's due.
- If she asks for something you cannot express as an op, return {"summary":"...","ops":[]} explaining why.
- Do not invent amounts she did not give. Leave planned_php at 0 if she named no figure.

Months:
- The state gives you the month she is currently viewing ("month") and today's date. Resolve names like "September" or "next month" to "YYYY-MM" using those. Prefer the nearest sensible future month when a bare month name is ambiguous.
- set_plan with "month":null means the month she is viewing. Set "month" ONLY when she names a different one.
- flow_plan repeats ONE amount for ONE category every month from from_month (null = the month she is viewing) through through_month inclusive. Use it for "make rent 4500 every month until December". Never use it for a sinking category — those land once, in their due month.
- move_month moves EVERY category's amount from one month to another. Use it for "I put all this in August but it should start in September". "mode":"move" empties the source month; "mode":"copy" leaves it alone. Default to "move" unless she says duplicate/copy/also.
- Prefer ONE move_month over many set_plan ops when she is relocating a whole month.

push_to_finances (only offered to a mentor; ignore it otherwise):
- Use it when the mentor asks to push, send, post or copy a month's budget into finances/expenses/the program ledger.
- It does not write anything — it opens the review screen where the mentor sets each outflow's date. Say so in the summary.
- It is the whole action on its own. Do not pair it with set_plan ops for the same month.

Revising a proposal:
- If you are given "The proposal she is correcting", she is fixing THAT list, not asking for something new. Return the COMPLETE corrected list of ops — every op that should still happen, with her correction applied — not just the changed one. Ops you drop will not happen.
- Keep the ops she did not mention exactly as they were.`;

// ── Tier 2: propose write operations ────────────────────────────────────────
export async function resolveBudgetOps(text, state, apiKey) {
  const pendingBlock = state?.pending?.ops?.length
    ? `\n\nThe proposal she is correcting (return the COMPLETE corrected list, keeping everything she did not mention):\n${JSON.stringify(state.pending)}`
    : '';

  const prompt = `${SYSTEM}

Current budget state:
${JSON.stringify(stateForPrompt(state))}${
    state?.isMentor
      ? '\n\nThe person asking is the MENTOR, not the scholar. push_to_finances is available.'
      : '\n\nThe person asking is the SCHOLAR. Never return push_to_finances.'
  }${pendingBlock}

Her request: ${text}`;

  const res = await callClaude({
    apiKey,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1500,
    temperature: 0.1,
  });
  if (!res.ok) return { error: res.error };

  const raw = textFromMessage(res.message);
  if (!raw) return { error: 'The AI returned nothing usable.' };

  let parsed;
  try {
    // Models still fence JSON occasionally despite the instruction above.
    parsed = JSON.parse(
      raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim()
    );
  } catch {
    return { error: 'The AI response was not valid JSON.' };
  }

  return { summary: String(parsed?.summary ?? ''), ops: sanitizeOps(parsed?.ops, state) };
}

// A pending proposal comes back from the client, so it is untrusted input like
// any other — re-run it through the same validator before it reaches the
// prompt rather than echoing whatever shape the caller sent.
export function sanitizePending(pending, state) {
  if (!pending || typeof pending !== 'object') return null;
  const ops = sanitizeOps(pending.ops, state);
  if (!ops.length) return null;
  return { summary: String(pending.summary ?? '').slice(0, 400), ops };
}

// Drop anything malformed or referring to a category that isn't this
// scholar's. The client re-checks nothing and the API re-checks ownership, but
// a proposal listing a stranger's id would still be confusing to render — and
// silently dropping it is better than showing the user an op that will 403.
export function sanitizeOps(ops, { categories, isMentor = false }) {
  // Archived categories are deliberately excluded. The route selects them (so
  // the model can see a name already exists), but an op referencing one would
  // render as "that category" in the approval list — and a change the user
  // cannot read is a change they cannot meaningfully approve.
  const known = new Set(categories.filter((c) => !c.archived_at).map((c) => String(c.id)));
  const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return (Array.isArray(ops) ? ops : []).reduce((out, o) => {
    if (!o || !OPS.includes(o.op)) return out;

    if (o.op === 'create_category') {
      const name = String(o.name ?? '')
        .trim()
        .slice(0, 60);
      if (!name) return out;
      const due = String(o.sinking_due_month ?? '');
      out.push({
        op: 'create_category',
        name,
        kind: KINDS.includes(o.kind) ? o.kind : 'variable',
        rollup: ROLLUPS.includes(o.rollup) ? o.rollup : 'personal',
        sinking_target_php: clampNonNegative(num(o.sinking_target_php)),
        sinking_due_month: MONTH_RE.test(due) ? due : null,
        planned_php: Math.max(0, num(o.planned_php) ?? 0),
      });
      return out;
    }

    if (o.op === 'update_category') {
      const id = String(o.id ?? '');
      if (!known.has(id)) return out;
      const patch = { op: 'update_category', id };
      if ('name' in o) {
        const n = String(o.name ?? '')
          .trim()
          .slice(0, 60);
        if (n) patch.name = n;
      }
      if (KINDS.includes(o.kind)) patch.kind = o.kind;
      if (ROLLUPS.includes(o.rollup)) patch.rollup = o.rollup;
      if ('sinking_target_php' in o)
        patch.sinking_target_php = clampNonNegative(num(o.sinking_target_php));
      if ('sinking_due_month' in o) {
        const due = String(o.sinking_due_month ?? '');
        patch.sinking_due_month = MONTH_RE.test(due) ? due : null;
      }
      // Nothing actually being changed — don't show a no-op.
      if (Object.keys(patch).length <= 2) return out;
      out.push(patch);
      return out;
    }

    if (o.op === 'archive_category') {
      const id = String(o.id ?? '');
      if (known.has(id)) out.push({ op: 'archive_category', id });
      return out;
    }

    if (o.op === 'flow_plan') {
      const id = String(o.category_id ?? '');
      if (!known.has(id)) return out;
      const through = String(o.through_month ?? '');
      if (!MONTH_RE.test(through)) return out; // a flow with no end is not applicable
      const from = String(o.from_month ?? '');
      out.push({
        op: 'flow_plan',
        category_id: id,
        planned_php: Math.max(0, num(o.planned_php) ?? 0),
        from_month: MONTH_RE.test(from) ? from : null, // null = the viewed month
        through_month: through,
      });
      return out;
    }

    if (o.op === 'push_to_finances') {
      // Enforced here, not just prompted: the prompt says a scholar never gets
      // this op, but a prompt is not an authorization boundary. (The API route
      // it opens is requireMentor anyway, so a scholar could only ever reach a
      // 403 — but rendering her a button that promises to touch the program
      // ledger is wrong on its own.)
      if (!isMentor) return out;
      const m = String(o.month ?? '');
      if (!MONTH_RE.test(m)) return out;
      out.push({ op: 'push_to_finances', month: m });
      return out;
    }

    if (o.op === 'move_month') {
      const from = String(o.from_month ?? '');
      const to = String(o.to_month ?? '');
      // Both months must be real AND different: a self-move is a no-op the
      // API rejects, and rendering it for approval would promise a change
      // that cannot happen.
      if (!MONTH_RE.test(from) || !MONTH_RE.test(to) || from === to) return out;
      out.push({
        op: 'move_month',
        from_month: from,
        to_month: to,
        mode: o.mode === 'copy' ? 'copy' : 'move',
      });
      return out;
    }

    // set_plan
    const id = String(o.category_id ?? '');
    if (!known.has(id)) return out;
    const m = String(o.month ?? '');
    out.push({
      op: 'set_plan',
      category_id: id,
      planned_php: Math.max(0, num(o.planned_php) ?? 0),
      month: MONTH_RE.test(m) ? m : null, // null = the viewed month
    });
    return out;
  }, []);
}
