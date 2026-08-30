// Bulk expense-edit resolver — turns a mentor's free-text instruction into
// corrected values for a set of ALREADY-SAVED expense rows.
//
// Read-only on the DB: this only asks Claude which rows to change. The caller
// diffs the result against the originals and applies the changes via the
// existing updateExpense/deleteExpense write path, so the blast radius stays
// "edit/delete rows the mentor was already looking at" and every change is
// shown for confirmation first.
//
// The model returns a DIFF, not the whole table. It used to be asked to echo
// every row back with all fields, which broke in two ways once a scholar had a
// few hundred expenses (Claire has 363):
//
//   1. Output length scaled with the table, not the edit. 363 rows x ~47
//      tokens is ~17k tokens of output for an instruction that changes four
//      rows — past any sane max_tokens, so the response was cut off mid-object
//      and failed to parse ("Could not parse the AI response as JSON").
//   2. Worse, the caller treats a row missing from the response as a DELETE.
//      A truncated response that happened to parse would have proposed
//      deleting every row past the cut. Only invalid JSON was stopping that.
//
// So the model now emits just {edits, deletes} and THIS function rebuilds the
// full row set by applying that diff to the originals. Output is proportional
// to the change, and completeness is guaranteed server-side rather than being
// something the model has to get right 363 times in a row — a row it never
// mentions is now, by construction, an unchanged row rather than a deletion.

import { EXPENSE_CATS } from '../../src/constants.js';
import { CLAUDE_MODEL, callClaude, textFromMessage } from './claude.js';

// Fields the model is allowed to change on a row. `id` is deliberately absent:
// ids identify rows, they are never an edit target.
const EDITABLE = ['item', 'amount', 'qty', 'cat', 'date', 'vendor', 'sem', 'status'];

export async function resolveExpenseBulkEdit(rows, text, apiKey) {
  const list = (rows ?? []).map((r) => ({
    id: String(r.id),
    item: r.item ?? '',
    amount: Number(r.amount) || 0,
    qty: Number(r.qty) || 1,
    cat: r.cat ?? 'Other',
    date: r.date ?? '',
    vendor: r.vendor ?? '',
    sem: r.sem ?? '',
    status: r.status ?? r.avb ?? 'Actual',
  }));

  if (list.length === 0) return { error: 'No saved expenses to edit for this scholar.' };

  const prompt = `You are editing a set of ALREADY-SAVED expense rows for a NextGen Scholars mentor. Work out which rows the mentor's instruction affects, and describe ONLY those changes.

Current rows (JSON array):
${JSON.stringify(list, null, 2)}

Mentor's instruction: "${text}"

Return ONLY a JSON object of the changes — never the whole table:
{
  "edits": [ { "id": "<id from the list>", "<field>": <new value>, ... } ],
  "deletes": [ "<id from the list>", ... ]
}

Rules:
- Include a row in "edits" ONLY if at least one of its field values actually changes, and list ONLY the fields that change (plus its "id"). Never restate unchanged fields.
- Put a row's id in "deletes" when the instruction asks to remove/delete it.
- Use ONLY ids that appear in the list above, copied character-for-character. Never invent an id, and never add new rows.
- Editable fields: ${EDITABLE.join(', ')}.
- "amount" is the unit price in PHP as a plain number (no symbols or commas); interpret natural-language money ("₱500", "500 pesos", "1.2k" → 1200).
- "cat" must be exactly one of: ${EXPENSE_CATS.join(', ')}.
- "date" is ISO 8601 YYYY-MM-DD. "status" is "Actual" or "Budget".
- Match dates/months carefully — "September 2026 through December 2026" means date >= 2026-09-01 and <= 2026-12-31.
- If nothing matches the instruction, return {"edits": [], "deletes": []}.
- Your entire response must be a single valid JSON object starting with { and ending with }.`;

  const res = await callClaude({
    apiKey,
    messages: [{ role: 'user', content: prompt }],
    // The response is now a small diff rather than the whole table, so this is
    // headroom for a large multi-row delete, not a length the model should aim
    // for. 'low' effort because thinking tokens count against max_tokens on
    // claude-sonnet-5 and this is bounded matching work, not open-ended
    // reasoning (see claude.js).
    maxTokens: 4096,
    effort: 'low',
  });
  if (!res.ok) return { error: res.error };

  const out = textFromMessage(res.message);
  if (!out) return { error: 'The AI returned an empty response — try rephrasing the instruction.' };

  let parsed;
  try {
    const cleaned = out
      .replace(/^```[a-z]*\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
    parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('not an object');
  } catch {
    return { error: `Could not parse the AI response as JSON: ${String(out).slice(0, 200)}` };
  }

  return { rows: applyExpenseDiff(list, parsed), model: CLAUDE_MODEL };
}

// Apply a model-proposed {edits, deletes} diff to the original rows, returning
// the complete resulting row set. Exported (and pure) so the delete/merge
// semantics — the part that can destroy real financial data if it's wrong — can
// be tested without an API call.
export function applyExpenseDiff(list, parsed) {
  const byId = new Map(list.map((r) => [r.id, r]));

  // Deletes: only ids that actually exist. An unknown id is dropped rather than
  // failing the whole edit — the mentor still reviews every row before it applies.
  const deleted = new Set(
    (Array.isArray(parsed.deletes) ? parsed.deletes : [])
      .map((id) => String(id))
      .filter((id) => byId.has(id))
  );

  // Edits: merge each patch onto its original row. Only whitelisted fields are
  // taken, and each is coerced to the shape the write path expects.
  //
  // An out-of-list `cat` is DROPPED, leaving the row's existing category alone.
  // The old code coerced it to 'Other' instead, which is how travel expenses
  // silently became Other/college and moved money between the bucket totals the
  // public profile pages publish (see CLAUDE.md) — with a partial patch, "leave
  // it as it was" is always the safer reading of an invalid value.
  const patches = new Map();
  for (const e of Array.isArray(parsed.edits) ? parsed.edits : []) {
    if (!e || typeof e !== 'object') continue;
    const id = String(e.id);
    const before = byId.get(id);
    if (!before || deleted.has(id)) continue;

    const patch = {};
    for (const f of EDITABLE) {
      if (!(f in e) || e[f] == null) continue;
      if (f === 'amount') patch.amount = Number(e.amount) || 0;
      else if (f === 'qty') patch.qty = Number(e.qty) || 1;
      else if (f === 'cat') {
        if (EXPENSE_CATS.includes(e.cat)) patch.cat = e.cat;
      } else if (f === 'status') patch.status = e.status === 'Budget' ? 'Budget' : 'Actual';
      else if (typeof e[f] === 'string') patch[f] = e[f];
    }
    if (Object.keys(patch).length) patches.set(id, patch);
  }

  // Rebuild the full row set: every original row, minus explicit deletes, with
  // patches applied. The caller's "row missing from this array => delete"
  // reading stays correct because completeness is enforced here, not by the model.
  return list
    .filter((r) => !deleted.has(r.id))
    .map((r) => (patches.has(r.id) ? { ...r, ...patches.get(r.id) } : r));
}
