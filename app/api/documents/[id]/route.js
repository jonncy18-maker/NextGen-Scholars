import { sql } from '../../../../lib/db.js';
import { requireScholarOwn } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

const ALLOWED_FIELDS = ['status', 'doc_type', 'sem', 'notes', 'linked_expense_id'];

// Covers both status transitions seen in DocumentsSection.jsx: 'linked'
// (after confirming an expense match) and 'reviewed' (mentor review action).
export const PATCH = withErrorHandling(async (request, { params }) => {
  await requireScholarOwn(request);
  const fields = await request.json();
  const keys = Object.keys(fields).filter(k => ALLOWED_FIELDS.includes(k));
  if (!keys.length) return json({ error: 'No valid fields to update' }, { status: 400 });

  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map(k => fields[k]);
  const [row] = await sql.query(
    `update documents set ${setClause} where id = $1 returning *`,
    [params.id, ...values]
  );
  if (!row) return json({ error: 'Not found' }, { status: 404 });
  return json(row);
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  await requireScholarOwn(request);
  await sql`delete from documents where id = ${params.id}`;
  return json({ ok: true });
});
