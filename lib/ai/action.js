// Action resolver — "record a GCash send" intent.
//
// The model is used ONLY to SELECT which unsent expense rows a free-text send
// description refers to (read-only on the DB). It never writes: the actual
// fee insert + mark-sent happen client-side via supabase-writer.js, so RLS and
// the existing optimistic UI flow stay in charge. This keeps the blast radius
// to "add a fee expense" + "set sent=Yes", both of which the mentor can undo.

import { sql } from '../db.js';
import { CLAUDE_MODEL, callClaude, textFromMessage } from './claude.js';

// GCash cash-out fee: ₱15 per ₱500 block. Mirrors the client (GcashCalculator).
function gcFee(n) {
  return Math.ceil(n / 500) * 15;
}

export async function resolveSendAction(scholar, text, apiKey) {
  let rows;
  try {
    rows =
      await sql`select id, item, amount, qty, sem, cat, sent from expenses where scholar = ${scholar} and sent <> 'Yes'`;
  } catch (err) {
    return { error: err.message };
  }

  // A row's real value is amount x qty (e.g. an "Event fee" of P500 x2). The
  // model and the fee maths both need the line total, not the unit price.
  const lineTotal = (r) => Number(r.amount || 0) * (Number(r.qty) || 1);

  const unsent = (rows ?? []).filter((r) => lineTotal(r) > 0);
  if (unsent.length === 0) return { note: 'Nothing unsent on record for this scholar.' };

  const list = unsent.map((r) => ({
    id: String(r.id),
    item: r.item,
    unitAmount: Number(r.amount),
    qty: Number(r.qty) || 1,
    amount: lineTotal(r),
    sem: r.sem,
    cat: r.cat,
  }));

  const prompt = `You map a mentor's free-text description of a money transfer to the specific UNSENT expense line items it pays for.

Unsent items (JSON array):
${JSON.stringify(list)}

The mentor said: "${text}"

Return ONLY a JSON object: {"ids": ["<id>", ...], "note": "<short explanation>"}.
Rules:
- The "amount" field is the line total already (unitAmount x qty); do not multiply it again.
- Include an id ONLY if the mentor's description clearly refers to that item (by name, month, category, amount, etc.).
- Match months/terms carefully (e.g. "July transport" → the Transport item dated/labelled July).
- If nothing clearly matches, return {"ids": [], "note": "<why>"}.
- NEVER invent ids. Use only ids that appear in the list above.`;

  const res = await callClaude({
    apiKey,
    messages: [{ role: 'user', content: prompt }],
    // Same fix as expense-edit.js/budget.js: thinking tokens count against
    // maxTokens on claude-sonnet-5, and 512 leaves almost no room for the
    // actual JSON once a reasoning pass eats into it. 'low' effort keeps
    // this bounded id-matching task cheap and leaves the budget free.
    maxTokens: 512,
    effort: 'low',
  });
  if (!res.ok) return { error: res.error };

  const out = textFromMessage(res.message)
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
  if (!out) return { note: 'The AI returned an empty response — try naming the items.' };

  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch {
    return { note: 'Could not parse the AI response — try naming the items.' };
  }

  const ids = Array.isArray(parsed.ids) ? parsed.ids.map(String) : [];
  const note = typeof parsed.note === 'string' ? parsed.note : undefined;
  const matched = unsent.filter((r) => ids.includes(String(r.id)));
  if (matched.length === 0) {
    return { note: note || 'No unsent items clearly matched that description.' };
  }

  const subtotal = matched.reduce((s, r) => s + lineTotal(r), 0);
  const fee = gcFee(subtotal);
  return {
    action: 'record_send',
    items: matched.map((r) => ({
      id: String(r.id),
      item: r.item,
      amount: lineTotal(r),
      qty: Number(r.qty) || 1,
      sem: r.sem,
    })),
    fee,
    total: subtotal + fee,
    note,
    model: CLAUDE_MODEL,
  };
}
