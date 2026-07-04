import { sql } from '../../../../../lib/db.js';
import { requireScholarOwn } from '../../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// Mirrors markSubmissionReadByScholar(id).
export const PATCH = withErrorHandling(async (request, { params }) => {
  await requireScholarOwn(request);
  const [row] = await sql`
    update expense_submissions set read_by_scholar = true where id = ${params.id} returning *
  `;
  if (!row) return json({ error: 'Not found' }, { status: 404 });
  return json(row);
});
