import { sql } from '../../../../../lib/db.js';
import { requireScholarOwn, AuthError } from '../../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../../lib/http.js';

export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Move or copy a WHOLE month's plan to another month.
//
// This exists because of a real and very recoverable mistake: a scholar
// budgets an entire month against the wrong month (she planned August when she
// meant September). Before this, the only fix was retyping every category by
// hand in the right month and zeroing each one in the wrong month — a dozen
// edits to undo one wrong click, which is the kind of chore people abandon
// half-finished, leaving two half-months of nonsense behind.
//
// Line-item breakdowns travel with the amounts. Moving living_plan without
// living_plan_item would leave the destination month showing a total whose
// "built from 5 items" breakdown lives in a different month — exactly the
// figure-contradicts-its-own-breakdown state PUT /living/plan works to avoid.
export const POST = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const body = await request.json();

  const from = String(body.from ?? '');
  const to = String(body.to ?? '');
  const mode = body.mode === 'copy' ? 'copy' : 'move';

  if (!MONTH_RE.test(from) || !MONTH_RE.test(to)) {
    return json({ error: 'from and to must be YYYY-MM' }, { status: 400 });
  }
  if (from === to) {
    return json({ error: 'from and to are the same month' }, { status: 400 });
  }

  // A mentor may act on a named scholar; a scholar is pinned to her own key
  // regardless of what the body says. Same rule as every other living route.
  const target = role === 'mentor' ? String(body.scholar ?? '') : scholarKey;
  if (!target) {
    throw new AuthError(role === 'mentor' ? 400 : 403, 'scholar required');
  }

  // Pre-read only to produce the friendly "nothing planned" message. The writes
  // below re-read the source inside the transaction, so a source edit landing
  // between this check and the transaction cannot be half-copied or deleted.
  const [{ n }] = await sql`
    select count(*)::int as n from living_plan
    where scholar = ${target} and month = ${from}
  `;
  if (n === 0) {
    return json({ error: `Nothing planned in ${from} to ${mode}.` }, { status: 400 });
  }

  // Everything is written in ONE transaction, using set-based INSERT ... SELECT
  // from the source month so the copy sees a single consistent snapshot. Any
  // failure rolls the whole thing back: the destination keeps its old totals
  // and breakdown, and the source is never deleted without the copy landing.
  // (sql.transaction is non-interactive, hence statements rather than reads.)
  const client = sql;
  const results = await client.transaction([
    // 0. Overwrite the destination for the categories being moved (on conflict
    //    update), rather than refusing when the destination already has amounts.
    //    Refusing would strand her: the usual case is a destination holding a
    //    half-typed guess she wants replaced by the real plan.
    client`
      insert into living_plan (scholar, month, category_id, planned_php, note)
      select scholar, ${to}, category_id, planned_php, note
      from living_plan
      where scholar = ${target} and month = ${from}
      on conflict (category_id, month) do update set
        planned_php = excluded.planned_php,
        note        = excluded.note,
        updated_at  = now()
      returning planned_php
    `,
    // 1. The destination's own breakdown must not survive being overwritten by
    //    a different month's total — it would contradict the number now sitting
    //    above it. Cleared for the moved categories, then replaced below if the
    //    source had one.
    client`
      delete from living_plan_item
      where scholar = ${target} and month = ${to}
        and category_id in (
          select category_id from living_plan
          where scholar = ${target} and month = ${from}
        )
    `,
    // 2. Copy the source breakdown across.
    client`
      insert into living_plan_item (scholar, month, category_id, name, qty, unit_php, basis, sort_order)
      select scholar, ${to}, category_id, name, qty, unit_php, basis, sort_order
      from living_plan_item
      where scholar = ${target} and month = ${from}
      returning id
    `,
    // 3-4. Move only: drop the source, items before totals.
    ...(mode === 'move'
      ? [
          client`delete from living_plan_item where scholar = ${target} and month = ${from}`,
          client`delete from living_plan where scholar = ${target} and month = ${from}`,
        ]
      : []),
  ]);
  const rows = results[0];
  const movedItems = results[2];
  // The source emptied between the pre-read and the transaction: every
  // statement above was a no-op, so report it like the pre-read would have.
  if (rows.length === 0) {
    return json({ error: `Nothing planned in ${from} to ${mode}.` }, { status: 400 });
  }

  return json({
    mode,
    from,
    to,
    categories: rows.length,
    items: movedItems.length,
    total: rows.reduce((s, r) => s + (Number(r.planned_php) || 0), 0),
  });
});
