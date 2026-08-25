import { sql } from '../../../lib/db.js';
import { requireScholarOwn, AuthError } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';
import { enforceRateLimit, readJsonBody } from '../../../lib/rate-limit.js';
import {
  resolveBudgetRead,
  resolveBudgetOps,
  looksLikeWriteIntent,
  sanitizePending,
} from '../../../lib/ai/budget.js';

// Scoped per-caller — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// AI for the scholar's living budget (/budget/:scholar).
//
// ── Why this is not part of /api/ask-scholar ────────────────────────────────
// ask-scholar is UNAUTHENTICATED by design and trusts a client-supplied
// `scholar` key (a documented accepted risk in CLAUDE.md). That is tolerable
// for the read/advisory surface it has today. It is NOT tolerable for a
// capability that mutates a budget: any anonymous caller could POST
// {scholar:'claire'} and rewrite her categories and amounts. So this route
// requires a real Better Auth session, resolves the scholar server-side from
// user_profile, and never takes the caller's word for who they are.
//
// The model still doesn't write. It proposes operations; the client shows them
// for approval and applies them through /api/living/**, which re-checks
// ownership on every call. This mirrors action.js and expense-edit.js.
//
// Authenticated (Better Auth), so this runs on Claude — the AI brain for
// signed-in mentor/scholar accounts (see CLAUDE.md "AI layer").

const MAX_BODY_BYTES = 32 * 1024;
const MAX_TEXT_CHARS = 2000;
// Authenticated, so this is quota protection rather than abuse protection —
// a stuck client retrying shouldn't be able to burn the Gemini budget.
const RATE_LIMIT = { limit: 40, windowSeconds: 300 };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const POST = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);

  const limited = await enforceRateLimit(request, 'ask-budget', RATE_LIMIT);
  if (limited) return limited;

  const { body, error } = await readJsonBody(request, MAX_BODY_BYTES);
  if (error) return error;
  if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

  // A scholar is pinned to her own key; only a mentor may name a scholar.
  let scholar;
  if (role === 'mentor') {
    scholar = String(body.scholar || '').trim();
    if (!scholar) return json({ error: 'Missing required field: scholar' }, { status: 400 });
  } else {
    if (!scholarKey) throw new AuthError(403, 'No scholar_key on profile');
    scholar = scholarKey;
  }

  const month = String(body.month || '');
  if (!MONTH_RE.test(month)) return json({ error: 'month must be YYYY-MM' }, { status: 400 });

  const text = String(body.text || '')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
  if (!text) return json({ error: 'Missing required field: text' }, { status: 400 });

  // State is read from the database, not accepted from the client. A caller
  // could otherwise hand the model a fabricated budget and get back ops
  // referencing ids it was told about rather than ids it owns.
  const [categories, planRows] = await Promise.all([
    sql`select * from living_category where scholar = ${scholar} order by sort_order, name`,
    sql`select * from living_plan where scholar = ${scholar} and month = ${month}`,
  ]);

  const plan = {};
  planRows.forEach((r) => {
    plan[r.category_id] = Number(r.planned_php) || 0;
  });
  const isMentor = role === 'mentor';
  const state = { categories, plan, month, isMentor };
  // The proposal being corrected, re-validated against this caller's own
  // categories rather than trusted as sent. See sanitizePending().
  state.pending = sanitizePending(body.pending, state);

  // Tier 1: answer it here if we can. Free, instant, and the arithmetic is
  // done on real rows rather than guessed by a language model.
  //
  // Skipped entirely when she's asking for a CHANGE. The read matchers are
  // substring tests, so "set my food total to 3000" would otherwise match
  // "total" and come back with her monthly total while changing nothing.
  //
  // Also skipped while a proposal is being corrected: "no, make it 3000" is a
  // revision, and answering it with a read would silently drop the pending
  // changes she is in the middle of fixing.
  const direct =
    state.pending || looksLikeWriteIntent(text) ? null : resolveBudgetRead(text, state);
  if (direct) return json({ kind: 'answer', tier: 1, text: direct });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(
      {
        kind: 'answer',
        tier: 1,
        text: "The AI assistant isn't configured yet, but you can still edit everything by hand on this page.",
      },
      { status: 200 }
    );
  }

  const result = await resolveBudgetOps(text, state, apiKey);
  if (result.error) return json({ kind: 'answer', tier: 2, text: result.error });

  // No operations means it understood but had nothing to change — treat the
  // summary as a plain answer rather than showing an empty approval card.
  if (!result.ops || result.ops.length === 0) {
    return json({ kind: 'answer', tier: 2, text: result.summary || 'Nothing to change.' });
  }

  return json({ kind: 'proposal', tier: 2, summary: result.summary, ops: result.ops });
});
