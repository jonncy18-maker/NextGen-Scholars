import { sql } from '../../../../lib/db.js';
import { requireScholarOwn, AuthError } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';
import { itemsTotalPhp } from '../../../../src/constants.js';

// Scoped per-caller (mentor sees any scholar, a scholar sees only her own) —
// must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const BASES = ['day', 'week', 'month'];

// See the matching helper in ../categories/route.js. A scholar with a null
// scholar_key is rejected rather than falling through to an unscoped query,
// which would return every scholar's rows.
function scopeFor({ role, scholarKey }, requestedScholar) {
  if (role === 'mentor') return requestedScholar || null;
  if (!scholarKey) throw new AuthError(403, 'No scholar_key on profile');
  return scholarKey;
}

// The single ownership gate for this route: derive the scholar from the
// CATEGORY, then confirm the caller owns it. A scholar can never write items
// against a category that isn't hers, whatever the request body claims —
// mirrors ../plan/route.js's PUT.
async function ownedCategory(categoryId, { role, scholarKey }) {
  if (!categoryId) throw new AuthError(400, 'category_id required');
  const [cat] = await sql`
    select id, scholar from living_category where id = ${categoryId}
  `;
  if (!cat) throw new AuthError(404, 'Unknown category');
  if (role !== 'mentor' && cat.scholar !== scholarKey) {
    throw new AuthError(403, 'Not authorized for this category');
  }
  return cat;
}

function clean(raw, i) {
  const qty = Number(raw?.qty);
  const unit = Number(raw?.unit_php ?? raw?.unitPhp);
  return {
    name: String(raw?.name ?? '')
      .trim()
      .slice(0, 80),
    qty: Number.isFinite(qty) && qty >= 0 ? qty : 1,
    unit: Number.isFinite(unit) && unit >= 0 ? unit : 0,
    basis: BASES.includes(raw?.basis) ? raw.basis : 'month',
    sort: Number.isFinite(Number(raw?.sort_order)) ? Number(raw.sort_order) : i,
  };
}

// GET ?category_id=&month=   — one category's items for one month
// GET ?scholar=&month=       — every itemised category for that month, so the
//                              Build list can show "built from N items" without
//                              a request per category.
export const GET = withErrorHandling(async (request) => {
  const user = await requireScholarOwn(request);
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  const categoryId = searchParams.get('category_id');

  if (month && !MONTH_RE.test(month)) {
    return json({ error: 'month must be YYYY-MM' }, { status: 400 });
  }

  if (categoryId) {
    await ownedCategory(categoryId, user);
    const rows = month
      ? await sql`select * from living_plan_item
                  where category_id = ${categoryId} and month = ${month}
                  order by sort_order, created_at`
      : await sql`select * from living_plan_item
                  where category_id = ${categoryId}
                  order by month desc, sort_order, created_at`;
    return json(rows);
  }

  const target = scopeFor(user, searchParams.get('scholar'));
  let rows;
  if (target && month) {
    rows = await sql`select * from living_plan_item
                     where scholar = ${target} and month = ${month}
                     order by category_id, sort_order, created_at`;
  } else if (target) {
    rows = await sql`select * from living_plan_item
                     where scholar = ${target}
                     order by month desc, sort_order, created_at`;
  } else if (month) {
    rows = await sql`select * from living_plan_item where month = ${month}
                     order by scholar, category_id, sort_order, created_at`;
  } else {
    rows = await sql`select * from living_plan_item
                     order by scholar, month desc, sort_order, created_at`;
  }
  return json(rows);
});

// PUT — replace one category's item list for one month, wholesale, and write
// the rolled-up total back to living_plan in the same call.
//
// Replace-all rather than per-row PATCH/DELETE: the builder is a single form
// the human edits freely (adding, removing and reordering rows before pressing
// Save), so one atomic "here is the list now" write matches how it is actually
// used and cannot leave a half-applied edit behind. It also keeps
// living_plan.planned_php and the items that justify it in step — the one
// invariant this table has to hold. Splitting them into two client calls would
// let the total save and the items fail, leaving a number nothing explains.
export const PUT = withErrorHandling(async (request) => {
  const user = await requireScholarOwn(request);
  const body = await request.json();

  const month = String(body.month ?? '');
  if (!MONTH_RE.test(month)) {
    return json({ error: 'month must be YYYY-MM' }, { status: 400 });
  }

  const cat = await ownedCategory(body.category_id, user);

  const incoming = Array.isArray(body.items) ? body.items : [];
  // A blank name means an untouched "+ Add item" row, not an error — drop it
  // rather than rejecting the whole save and losing her other edits.
  const cleaned = incoming.map(clean).filter((it) => it.name);

  const total = itemsTotalPhp(
    cleaned.map((it) => ({ qty: it.qty, unit_php: it.unit, basis: it.basis }))
  );

  // Neon's HTTP driver has no interactive transaction, so this is a delete +
  // insert + upsert sequence rather than a BEGIN block. Safe here: the delete
  // is scoped to exactly the (category, month) being rewritten, and a failure
  // between steps leaves the items gone but living_plan unchanged — visibly
  // wrong in the builder (which reloads) rather than silently wrong in a total.
  await sql`
    delete from living_plan_item
    where category_id = ${cat.id} and month = ${month}
  `;

  const rows = [];
  for (let i = 0; i < cleaned.length; i++) {
    const it = cleaned[i];
    const [row] = await sql`
      insert into living_plan_item
        (scholar, category_id, month, name, qty, unit_php, basis, sort_order)
      values
        (${cat.scholar}, ${cat.id}, ${month}, ${it.name}, ${it.qty},
         ${it.unit}, ${it.basis}, ${i})
      returning *
    `;
    rows.push(row);
  }

  const [plan] = await sql`
    insert into living_plan (scholar, month, category_id, planned_php)
    values (${cat.scholar}, ${month}, ${cat.id}, ${total})
    on conflict (category_id, month) do update set
      planned_php = excluded.planned_php,
      updated_at  = now()
    returning *
  `;

  return json({ items: rows, plan, total });
});

// DELETE ?category_id=&month=  — drop the breakdown, keep the category.
// living_plan.planned_php is left where it is: she is converting an itemised
// category back to a simple one, and zeroing the amount she just had would be
// a destructive surprise rather than a simplification.
export const DELETE = withErrorHandling(async (request) => {
  const user = await requireScholarOwn(request);
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  if (!MONTH_RE.test(String(month))) {
    return json({ error: 'month must be YYYY-MM' }, { status: 400 });
  }
  const cat = await ownedCategory(searchParams.get('category_id'), user);

  await sql`
    delete from living_plan_item
    where category_id = ${cat.id} and month = ${month}
  `;
  return json({ ok: true });
});
