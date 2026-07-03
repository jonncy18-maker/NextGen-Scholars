import { sql } from '../../../../../lib/db.js';
import { requireMentor } from '../../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../../lib/http.js';

// Mirrors rejectSubmission(submissionId, comment).
export const POST = withErrorHandling(async (request, { params }) => {
  await requireMentor(request);
  const { comment } = await request.json().catch(() => ({}));
  const [row] = await sql`
    update expense_submissions
    set status = 'rejected', rejection_comment = ${comment || null}, reviewed_at = now()
    where id = ${params.id}
    returning *
  `;
  if (!row) return json({ error: 'Not found' }, { status: 404 });
  return json(row);
});
