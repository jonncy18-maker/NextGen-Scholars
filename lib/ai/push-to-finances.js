// Mapping a scholar's OWN living-budget categories onto the mentor's sponsor
// expense categories, for the "Push to Finances" flow on /budget/:scholar.
//
// ── Why this needs to exist at all ─────────────────────────────────────────
// The two ledgers are deliberately incompatible (db/living_budget.sql): her
// categories are user-defined rows she invents ("Load & Data", "Fare Home"),
// EXPENSE_CATS are a fixed sponsor list ("Tuition", "Uniforms"). Nothing joins
// them by name, so something has to decide that "Dorm Rent" is a 'Living
// Expenses' outflow. A deterministic rollup map gets most of it; Claude is
// asked only to refine, and a human approves every row before anything is
// written.
//
// ── The double-count rule still applies ────────────────────────────────────
// This does NOT sum the two ledgers. It CONVERTS her plan into the program
// ledger for a month, and the route replaces the single lump-sum allowance
// expense row for that month rather than adding to it — so the program total
// stays equal to her allowance, just itemised. See the route for that part.

import { EXPENSE_CATS, CAT_TO_BUCKET } from '../../src/constants.js';
import { callClaude, textFromMessage } from './claude.js';

// Deterministic first pass, keyed on the stable `rollup` (not her free-text
// name, which is exactly the part that varies between scholars). This alone
// is a correct-if-coarse answer, and is the fallback whenever Claude is
// unavailable, slow, or returns something not on the list.
//
// Everything defaults to 'Living Expenses' (bucket 'life') because that is
// what her allowance IS from the program's side. Moving a row to a college or
// travel category is a real decision with real consequences — it shifts money
// into a bucket the public profile pages publish — so that is left to Claude
// to propose and the mentor to confirm, never assumed here.
const ROLLUP_DEFAULT_CAT = {
  housing: 'Living Expenses',
  food: 'Living Expenses',
  transport: 'Living Expenses',
  school: 'Living Expenses',
  personal: 'Living Expenses',
  savings: 'Living Expenses',
};

export function defaultCatFor(category) {
  return ROLLUP_DEFAULT_CAT[category?.rollup] || 'Living Expenses';
}

export function bucketFor(cat) {
  return CAT_TO_BUCKET[cat] || 'college';
}

const SYSTEM = `You map a nursing scholar's personal living-budget categories onto a scholarship program's fixed expense categories.

The scholar invents her own category names (e.g. "Load & Data", "Dorm Rent", "Fare Home"). You must map each one to EXACTLY ONE category from this closed list:
${EXPENSE_CATS.map((c) => `- ${c}`).join('\n')}

Rules:
- Default to "Living Expenses" for ordinary personal upkeep — food, rent, utilities, transport, toiletries, laundry, phone load, savings. This is the correct answer for the large majority of rows, because this money IS her monthly allowance.
- Only choose a different category when the cost is unmistakably that thing (e.g. a category literally about printing coursework -> "Printing & Research"; one literally about school supplies -> "School Supplies").
- Never invent a category name. Never return one not on the list above.
- Be conservative. If unsure, choose "Living Expenses".

Respond with ONLY a JSON array, no prose, no markdown fence:
[{"id":"<the category id given to you>","cat":"<one of the list>","reason":"<max 8 words>"}]`;

// Returns a Map of category id -> { cat, reason }. Never throws: any failure
// (no key, API error, malformed JSON, unknown category) degrades to the
// deterministic map rather than blocking the mentor's flow.
export async function mapCategories(categories, apiKey) {
  const out = new Map();
  if (!categories?.length) return out;

  if (!apiKey) return out;

  const payload = categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    rollup: c.rollup,
  }));

  const res = await callClaude({
    apiKey,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
    maxTokens: 1500,
  });

  if (!res.ok) return out;

  let parsed;
  try {
    const text = textFromMessage(res.message)
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    parsed = JSON.parse(text);
  } catch {
    return out;
  }
  if (!Array.isArray(parsed)) return out;

  // The model's output is untrusted input, same rule as lib/ai/tools.js:
  // validate the category against the real constant rather than trusting it
  // through to a write. An unrecognised value is dropped, not coerced — the
  // caller's deterministic default then applies.
  for (const row of parsed) {
    if (!row || typeof row.id !== 'string') continue;
    if (!EXPENSE_CATS.includes(row.cat)) continue;
    out.set(row.id, {
      cat: row.cat,
      reason: typeof row.reason === 'string' ? row.reason.slice(0, 80) : '',
    });
  }
  return out;
}

// Build the full proposal: one row per budgeted category, with the mapped
// sponsor category and its derived bucket. `plan` is a Map of
// category_id -> planned_php read server-side (never accepted from a caller).
export function buildProposal(categories, planMap, aiMap) {
  return categories
    .map((c) => {
      const amount = Number(planMap.get(c.id)) || 0;
      if (amount <= 0) return null;
      const ai = aiMap.get(c.id);
      const cat = ai?.cat || defaultCatFor(c);
      return {
        category_id: c.id,
        name: c.name,
        kind: c.kind,
        rollup: c.rollup,
        amount_php: amount,
        cat,
        bucket: bucketFor(cat),
        reason: ai?.reason || 'Default for this group',
        mapped_by: ai ? 'ai' : 'default',
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.amount_php - a.amount_php);
}
