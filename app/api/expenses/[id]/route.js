import { sql } from '../../../../lib/db.js';
import { requireMentor } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = ['scholar', 'sem', 'item', 'cat', 'bucket', 'amount', 'qty', 'date', 'avb', 'sent', 'vendor', 'group_id'];

// Mirrors updateExpense(id, fields) / writeSent(id) — arbitrary field-subset
// update (writeSent just sends { sent: 'Yes' }).
export const PATCH = withErrorHandling(async (request, { params }) => {
  await requireMentor(request);
  const fields = await request.json();
  const keys = Object.keys(fields).filter(k => ALLOWED_FIELDS.includes(k));
  if (!keys.length) return json({ error: 'No valid fields to update' }, { status: 400 });

  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map(k => fields[k]);
  const [row] = await sql.query(
    `update expenses set ${setClause} where id = $1 returning *`,
    [params.id, ...values]
  );
  if (!row) return json({ error: 'Not found' }, { status: 404 });
  return json(row);
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  await requireMentor(request);
  await sql`delete from expenses where id = ${params.id}`;
  return json({ ok: true });
});
