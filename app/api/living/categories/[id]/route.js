import { sql } from '../../../../../lib/db.js';
import { requireScholarOwn } from '../../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../../lib/http.js';

export const dynamic = 'force-dynamic';

const KINDS   = ['fixed', 'variable', 'sinking'];
const ROLLUPS = ['housing', 'food', 'transport', 'school', 'personal', 'savings'];

// Load a category the caller is actually allowed to touch. A scholar is scoped
// to her own key here, not just in the UI — otherwise anyone with a valid
// scholar token could edit another scholar's categories by guessing an id.
async function loadOwned(id, { role, scholarKey }) {
  const rows = role === 'mentor'
    ? await sql`select * from living_category where id = ${id}`
    : await sql`select * from living_category where id = ${id} and scholar = ${scholarKey}`;
  return rows[0] ?? null;
}

// Partial update. Read-then-write rather than a dynamically built SET clause,
// so that explicitly clearing a sinking target (to null) is distinguishable
// from simply not mentioning the field.
export const PATCH = withErrorHandling(async (request, { params }) => {
  // Next 16: params is a Promise in route handlers.
  const { id } = await params;
  const user = await requireScholarOwn(request);
  const body = await request.json();

  const cur = await loadOwned(id, user);
  if (!cur) return json({ error: 'Not found' }, { status: 404 });

  const name = 'name' in body
    ? String(body.name ?? '').trim().slice(0, 60)
    : cur.name;
  if (!name) return json({ error: 'name required' }, { status: 400 });

  const kind = 'kind' in body && KINDS.includes(body.kind) ? body.kind : cur.kind;
  const rollup = 'rollup' in body && ROLLUPS.includes(body.rollup) ? body.rollup : cur.rollup;

  // Non-numeric input clears the field rather than reaching Postgres as NaN.
  const asNum = (v) => {
    if (v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const target = 'sinking_target_php' in body
    ? asNum(body.sinking_target_php)
    : cur.sinking_target_php;

  const rawMonths = 'sinking_months' in body ? asNum(body.sinking_months) : cur.sinking_months;
  const months = rawMonths === null ? null : Math.max(1, Math.round(rawMonths));

  const sort = 'sort_order' in body && Number.isFinite(Number(body.sort_order))
    ? Number(body.sort_order)
    : cur.sort_order;

  // Un-archive is the only way back; see DELETE below for why we never drop rows.
  const archivedAt = 'archived' in body
    ? (body.archived ? (cur.archived_at ?? new Date().toISOString()) : null)
    : cur.archived_at;

  const [row] = await sql`
    update living_category set
      name = ${name},
      kind = ${kind},
      rollup = ${rollup},
      sinking_target_php = ${target},
      sinking_months = ${months},
      sort_order = ${sort},
      archived_at = ${archivedAt},
      updated_at = now()
    where id = ${id}
    returning *
  `;

  return json(row);
});

// Archive, never destroy. A category with plan or actual rows behind it cannot
// be hard-deleted without orphaning that history and silently changing past
// months' totals — so "delete" in the UI lands here and simply hides it from
// new entry. An unused category (no plan rows ever) is the one safe exception.
export const DELETE = withErrorHandling(async (request, { params }) => {
  const { id } = await params;
  const user = await requireScholarOwn(request);

  const cur = await loadOwned(id, user);
  if (!cur) return json({ error: 'Not found' }, { status: 404 });

  // Delete and the "has no history" test must be ONE statement. Checking the
  // count first and deleting second leaves a window where a plan row inserted
  // in between gets silently removed by the FK's on-delete-cascade — exactly
  // the history loss the archive rule exists to prevent.
  const dropped = await sql`
    delete from living_category
    where id = ${id}
      and not exists (select 1 from living_plan where category_id = ${id})
    returning id
  `;
  if (dropped.length > 0) return json({ deleted: true, archived: false });

  const [row] = await sql`
    update living_category
    set archived_at = now(), updated_at = now()
    where id = ${id}
    returning *
  `;
  return json({ deleted: false, archived: true, category: row });
});
