import { sql } from '../../../../lib/db.js';
import { requireScholarOwn, AuthError } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

// Scoped per-caller (mentor sees all scholars, a scholar sees only her own) —
// must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

const KINDS   = ['fixed', 'variable', 'sinking'];
const ROLLUPS = ['housing', 'food', 'transport', 'school', 'personal', 'savings'];

// Resolve who a request is allowed to touch. A scholar whose profile has no
// scholar_key must be rejected outright, NOT silently treated as "unscoped" —
// an unscoped query here returns every scholar's rows. `user_profile
// .scholar_key` is nullable, and app/api/submissions/route.js already treats a
// keyless scholar as a real possibility, so this is a live case rather than a
// theoretical one.
function scopeFor({ role, scholarKey }, requestedScholar) {
  if (role === 'mentor') return requestedScholar || null;   // null = all scholars
  if (!scholarKey) throw new AuthError(403, 'No scholar_key on profile');
  return scholarKey;
}

// Accept either the DB's snake_case or the camelCase used by the seed/prompt
// templates in src/constants.js, so a prompt's sinkingMonths can't silently
// vanish on the way in (which would leave every sinking fund with no accrual —
// the one number those categories exist to produce).
function num(...vals) {
  for (const v of vals) {
    if (v === undefined) continue;
    if (v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function clean(c) {
  const months = num(c?.sinking_months, c?.sinkingMonths);
  return {
    name:   String(c?.name ?? '').trim().slice(0, 60),
    kind:   KINDS.includes(c?.kind) ? c.kind : 'variable',
    rollup: ROLLUPS.includes(c?.rollup) ? c.rollup : 'personal',
    target: num(c?.sinking_target_php, c?.sinkingTargetPhp),
    months: months === null ? null : Math.max(1, Math.round(months)),
    sort:   num(c?.sort_order, c?.sortOrder) ?? 0,
  };
}

export const GET = withErrorHandling(async (request) => {
  const user = await requireScholarOwn(request);
  const { searchParams } = new URL(request.url);
  const target = scopeFor(user, searchParams.get('scholar'));

  // Archived categories stay queryable so past months still render with their
  // original names — but they're excluded by default from the picker.
  const includeArchived = searchParams.get('archived') === '1';

  // Branched rather than passing a JS boolean into the WHERE clause, so every
  // query here is a plain parameterised template with no untyped literals.
  let rows;
  if (target && includeArchived) {
    rows = await sql`select * from living_category where scholar = ${target} order by sort_order, name`;
  } else if (target) {
    rows = await sql`select * from living_category where scholar = ${target} and archived_at is null order by sort_order, name`;
  } else if (includeArchived) {
    rows = await sql`select * from living_category order by scholar, sort_order, name`;
  } else {
    rows = await sql`select * from living_category where archived_at is null order by scholar, sort_order, name`;
  }

  return json(rows);
});

// Create one category, or seed several at once ({ categories: [...] }) the
// first time a scholar opens her budget.
export const POST = withErrorHandling(async (request) => {
  const user = await requireScholarOwn(request);
  const body = await request.json();

  // A scholar can only ever write to her own key, whatever the body claims.
  const scholar = user.role === 'mentor' ? body.scholar : scopeFor(user, null);
  if (!scholar) return json({ error: 'scholar required' }, { status: 400 });

  const incoming = Array.isArray(body.categories) ? body.categories : [body];
  const cleaned  = incoming.map(clean).filter(c => c.name);
  if (cleaned.length === 0) return json({ error: 'name required' }, { status: 400 });

  // Whether a name that exists but is archived should be brought back.
  // Tapping a chip or typing a name she archived earlier SHOULD restore it —
  // that's a deliberate act. The first-visit seed should NOT: if she archived
  // every category, re-posting the starter set would resurrect all nine and
  // overwrite the kind/rollup/sinking settings she'd customised on them.
  const restoreArchived = body.restoreArchived !== false;

  // Existing names for this scholar, archived ones included — a name is taken
  // whether or not the category is currently visible.
  const existing = await sql`
    select id, name, archived_at from living_category where scholar = ${scholar}
  `;
  const byName = new Map(existing.map(r => [r.name.toLowerCase(), r]));

  const rows = [];
  for (const c of cleaned) {
    const prior = byName.get(c.name.toLowerCase());

    // Re-adding something she archived earlier restores it rather than doing
    // nothing. Previously this silently returned an empty array: the chip
    // reappeared in "Easy to forget", tapping it produced no visible change,
    // and no amount of retrying ever would.
    if (prior) {
      if (prior.archived_at && restoreArchived) {
        const [row] = await sql`
          update living_category set
            archived_at = null,
            kind = ${c.kind},
            rollup = ${c.rollup},
            sinking_target_php = ${c.target},
            sinking_months = ${c.months},
            updated_at = now()
          where id = ${prior.id}
          returning *
        `;
        rows.push(row);
      }
      continue;   // already active — nothing to do
    }

    // `on conflict do nothing` against the (scholar, lower(name)) unique index
    // is what actually makes seeding idempotent. The name check above is a
    // convenience, not a guarantee: it and the insert are separate round trips,
    // so two tabs (or React StrictMode's double-mounted effect, whose cancel
    // flag suppresses state updates but does not abort an in-flight POST) can
    // both observe an empty table and both try to seed.
    const inserted = await sql`
      insert into living_category
        (scholar, name, kind, rollup, sinking_target_php, sinking_months, sort_order)
      values
        (${scholar}, ${c.name}, ${c.kind}, ${c.rollup}, ${c.target}, ${c.months}, ${c.sort})
      on conflict (scholar, lower(name)) do nothing
      returning *
    `;
    if (inserted[0]) rows.push(inserted[0]);
  }

  return json(rows, { status: rows.length ? 201 : 200 });
});
