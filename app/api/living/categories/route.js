import { sql } from '../../../../lib/db.js';
import { requireScholarOwn } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

// Scoped per-caller (mentor sees all scholars, a scholar sees only her own) —
// must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

const KINDS   = ['fixed', 'variable', 'sinking'];
const ROLLUPS = ['housing', 'food', 'transport', 'school', 'personal', 'savings'];

// Coerce an incoming category to a safe row shape. Anything outside the known
// kind/rollup sets falls back to the permissive default rather than reaching
// Postgres and tripping the CHECK constraint as a 500.
function clean(c) {
  return {
    name:    String(c?.name ?? '').trim().slice(0, 60),
    kind:    KINDS.includes(c?.kind) ? c.kind : 'variable',
    rollup:  ROLLUPS.includes(c?.rollup) ? c.rollup : 'personal',
    target:  c?.sinking_target_php == null ? null : Number(c.sinking_target_php),
    months:  c?.sinking_months == null ? null : Math.max(1, Math.round(Number(c.sinking_months))),
    sort:    Number.isFinite(Number(c?.sort_order)) ? Number(c.sort_order) : 0,
  };
}

export const GET = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const { searchParams } = new URL(request.url);

  // Archived categories stay queryable so past months still render with their
  // original names — but they're excluded by default from the picker.
  const includeArchived = searchParams.get('archived') === '1';
  // A mentor may look at one scholar explicitly; otherwise they get everyone.
  const target = role === 'mentor' ? searchParams.get('scholar') : scholarKey;

  const rows = target
    ? await sql`
        select * from living_category
        where scholar = ${target}
          and (${includeArchived} or archived_at is null)
        order by sort_order, name
      `
    : await sql`
        select * from living_category
        where (${includeArchived} or archived_at is null)
        order by scholar, sort_order, name
      `;

  return json(rows);
});

// Create one category, or seed several at once ({ categories: [...] }) the
// first time a scholar opens her budget.
export const POST = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const body = await request.json();

  // A scholar can only ever write to her own key, whatever the body claims.
  const scholar = role === 'mentor' ? body.scholar : scholarKey;
  if (!scholar) return json({ error: 'scholar required' }, { status: 400 });

  const incoming = Array.isArray(body.categories) ? body.categories : [body];
  const cleaned  = incoming.map(clean).filter(c => c.name);
  if (cleaned.length === 0) return json({ error: 'name required' }, { status: 400 });

  // Seeding is idempotent: opening the budget twice in two tabs must not
  // produce two "Dorm Rent" rows. A name already present for this scholar
  // (archived or not) is skipped rather than duplicated.
  const existing = await sql`
    select lower(name) as name from living_category where scholar = ${scholar}
  `;
  const taken = new Set(existing.map(r => r.name));
  const fresh = cleaned.filter(c => !taken.has(c.name.toLowerCase()));
  if (fresh.length === 0) return json([], { status: 200 });

  const rows = [];
  for (const c of fresh) {
    const [row] = await sql`
      insert into living_category
        (scholar, name, kind, rollup, sinking_target_php, sinking_months, sort_order)
      values
        (${scholar}, ${c.name}, ${c.kind}, ${c.rollup}, ${c.target}, ${c.months}, ${c.sort})
      returning *
    `;
    rows.push(row);
  }

  return json(rows, { status: 201 });
});
