import { sql } from '../../../../lib/db.js';
import { requireScholarOwn } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = ['subject', 'units', 'school', 'prelim', 'midterm', 'final_grade', 'period_avg', 'pct_equiv'];

// Neon returns NUMERIC columns as strings — coerce before handing the
// updated row back to GradesSection.jsx, which calls .toFixed() on these
// fields (see the same helper in ../route.js).
const NUMERIC_COLS = ['units', 'prelim', 'midterm', 'final_grade', 'period_avg', 'pct_equiv'];
function coerceNumeric(row) {
  const out = { ...row };
  for (const col of NUMERIC_COLS) {
    if (out[col] != null) out[col] = Number(out[col]);
  }
  return out;
}

// Mirrors GradesSection.jsx's inline row-edit update (field subset).
//
// requireScholarOwn() only proves the caller is *a* scholar — it does not scope
// the row. Both handlers below must therefore carry `and scholar = <own key>`
// for the scholar role, or any signed-in scholar could edit/delete another
// scholar's grades by id (same shape as submissions/[id]/route.js).
export const PATCH = withErrorHandling(async (request, { params }) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const fields = await request.json();
  const keys = Object.keys(fields).filter(k => ALLOWED_FIELDS.includes(k));
  if (!keys.length) return json({ error: 'No valid fields to update' }, { status: 400 });

  const values = keys.map(k => fields[k]);
  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const scope = role === 'mentor' ? '' : ` and scholar = $${keys.length + 2}`;
  const [row] = await sql.query(
    `update grade_entries set ${setClause} where id = $1${scope} returning *`,
    role === 'mentor' ? [params.id, ...values] : [params.id, ...values, scholarKey]
  );
  if (!row) return json({ error: 'Not found' }, { status: 404 });
  return json(coerceNumeric(row));
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  // Stays idempotent (no 404 on a missing row) to match the previous
  // behavior — GradesSection.jsx treats any non-2xx here as a hard error, and
  // a scholar aiming at someone else's row simply deletes nothing.
  if (role === 'mentor') {
    await sql`delete from grade_entries where id = ${params.id}`;
  } else {
    await sql`delete from grade_entries where id = ${params.id} and scholar = ${scholarKey}`;
  }
  return json({ ok: true });
});
