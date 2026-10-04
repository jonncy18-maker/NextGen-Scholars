import { sql } from '../../../../lib/db.js';
import { requireMentor } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';
import { CAT_TO_BUCKET, EXPENSE_CATS } from '../../../../src/constants.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = ['scholar', 'sem', 'item', 'cat', 'bucket', 'amount', 'qty', 'date', 'avb', 'sent', 'vendor', 'group_id'];

// Mirrors updateExpense(id, fields) / writeSent(id) — arbitrary field-subset
// update (writeSent just sends { sent: 'Yes' }).
export const PATCH = withErrorHandling(async (request, { params }) => {
  const { id } = await params;
  await requireMentor(request);
  const fields = await request.json();
  const keys = Object.keys(fields).filter(k => ALLOWED_FIELDS.includes(k));
  if (!keys.length) return json({ error: 'No valid fields to update' }, { status: 400 });

  // A changed category re-derives the bucket, so the two cannot drift apart.
  // An explicit `bucket` alongside `cat` is kept: the mentor's manual bucket
  // dropdown in the expense edit form sends both on purpose.
  const values = {};
  for (const k of keys) values[k] = fields[k];
  if ('cat' in values) {
    if (!EXPENSE_CATS.includes(values.cat)) {
      return json({ error: `Unknown category: ${values.cat}` }, { status: 400 });
    }
    if (!values.bucket) {
      if (!keys.includes('bucket')) keys.push('bucket');
      values.bucket = CAT_TO_BUCKET[values.cat] || 'college';
    }
  }

  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const [row] = await sql.query(
    `update expenses set ${setClause} where id = $1 returning *`,
    [id, ...keys.map(k => values[k])]
  );
  if (!row) return json({ error: 'Not found' }, { status: 404 });
  return json(row);
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  const { id } = await params;
  await requireMentor(request);
  await sql`delete from expenses where id = ${id}`;
  return json({ ok: true });
});
