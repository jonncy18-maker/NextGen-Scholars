import { sql } from '../../../../../lib/db.js';
import { requireScholarOwn } from '../../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// Mirrors markSubmissionReadByScholar(id).
//
// Scoped to the caller's own key for the scholar role: requireScholarOwn() only
// proves the caller is *a* scholar, and `returning *` hands back the whole row
// (expense_data, rejection_comment, …) — so without the scope this both let one
// scholar flip another's read flag and disclosed that submission's contents.
export const PATCH = withErrorHandling(async (request, { params }) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const rows = role === 'mentor'
    ? await sql`
        update expense_submissions set read_by_scholar = true
        where id = ${params.id} returning *
      `
    : await sql`
        update expense_submissions set read_by_scholar = true
        where id = ${params.id} and scholar_key = ${scholarKey} returning *
      `;
  const [row] = rows;
  if (!row) return json({ error: 'Not found' }, { status: 404 });
  return json(row);
});
