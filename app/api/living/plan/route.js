import { sql } from '../../../../lib/db.js';
import { requireScholarOwn, AuthError } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;   // 'YYYY-MM' — monthly, not per-semester

// See the matching helper in ../categories/route.js: a scholar with a null
// scholar_key must be rejected rather than falling through to the unscoped
// query, which would return every scholar's planned amounts.
function scopeFor({ role, scholarKey }, requestedScholar) {
  if (role === 'mentor') return requestedScholar || null;   // null = all scholars
  if (!scholarKey) throw new AuthError(403, 'No scholar_key on profile');
  return scholarKey;
}

export const GET = withErrorHandling(async (request) => {
  const user = await requireScholarOwn(request);
  const { searchParams } = new URL(request.url);
  const month  = searchParams.get('month');
  const target = scopeFor(user, searchParams.get('scholar'));

  if (month && !MONTH_RE.test(month)) {
    return json({ error: 'month must be YYYY-MM' }, { status: 400 });
  }

  // Four combinations of (scoped to a scholar?) x (scoped to a month?), written
  // out rather than concatenated so every query stays a parameterised template.
  let rows;
  if (target && month) {
    rows = await sql`select * from living_plan where scholar = ${target} and month = ${month}`;
  } else if (target) {
    rows = await sql`select * from living_plan where scholar = ${target} order by month desc`;
  } else if (month) {
    rows = await sql`select * from living_plan where month = ${month}`;
  } else {
    rows = await sql`select * from living_plan order by month desc`;
  }

  return json(rows);
});

// Upsert one category's planned amount for one month. Keyed on
// (category_id, month), so editing an amount updates in place instead of
// stacking duplicate rows as she revises her estimate.
export const PUT = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  if (role !== 'mentor' && !scholarKey) {
    throw new AuthError(403, 'No scholar_key on profile');
  }
  const body = await request.json();

  const month = String(body.month ?? '');
  if (!MONTH_RE.test(month)) {
    return json({ error: 'month must be YYYY-MM' }, { status: 400 });
  }
  if (!body.category_id) {
    return json({ error: 'category_id required' }, { status: 400 });
  }

  // Derive the scholar from the CATEGORY, then check the caller owns it. This
  // is the single ownership gate for planning: a scholar cannot write a plan
  // row against a category that isn't hers, whatever the body says.
  const [cat] = await sql`
    select id, scholar from living_category where id = ${body.category_id}
  `;
  if (!cat) return json({ error: 'Unknown category' }, { status: 404 });
  if (role !== 'mentor' && cat.scholar !== scholarKey) {
    return json({ error: 'Not authorized for this category' }, { status: 403 });
  }

  const planned = Number(body.planned_php);
  if (!Number.isFinite(planned) || planned < 0) {
    return json({ error: 'planned_php must be a non-negative number' }, { status: 400 });
  }

  const note = body.note == null ? null : String(body.note).slice(0, 500);

  // Writing a bare total means "this is the number now", so any line-item
  // breakdown for the same month has to go. Leaving it would produce a figure
  // its own breakdown contradicts — the builder would reopen showing items
  // that sum to something else, and the Build list would keep advertising
  // "built from 5 items" against a number those items never produced.
  //
  // This is the single chokepoint for that rule: the builder's Simple mode,
  // the inline amount box, and the AI panel's `set_plan` op all land here, so
  // none of them can leave the two out of step. The itemised path does NOT go
  // through this route — app/api/living/items writes items and their rolled-up
  // total together in one call.
  await sql`
    delete from living_plan_item
    where category_id = ${cat.id} and month = ${month}
  `;

  const [row] = await sql`
    insert into living_plan (scholar, month, category_id, planned_php, note)
    values (${cat.scholar}, ${month}, ${cat.id}, ${planned}, ${note})
    on conflict (category_id, month) do update set
      planned_php = excluded.planned_php,
      note        = excluded.note,
      updated_at  = now()
    returning *
  `;

  return json(row);
});
