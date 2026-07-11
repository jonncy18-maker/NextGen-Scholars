import { sql } from '../../../../lib/db.js';
import { requireScholarOwn } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// Mirrors updateSubmission(id, expenseData) — a scholar (or mentor) edits the
// contents of a still-pending submission in place. Only 'pending' rows are
// editable: once a mentor has approved/rejected it — or it's been superseded
// by a resubmit — the expense_data is frozen. Scholars are additionally
// constrained to their own rows (the RLS anon_update policy is permissive, so
// the scoping that matters is enforced here at the app layer).
export const PATCH = withErrorHandling(async (request, { params }) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const { expenseData } = await request.json();
  if (!expenseData || typeof expenseData !== 'object') {
    return json({ error: 'expenseData required' }, { status: 400 });
  }

  const rows =
    role === 'mentor'
      ? await sql`
          update expense_submissions
          set expense_data = ${expenseData}
          where id = ${params.id} and status = 'pending'
          returning *
        `
      : await sql`
          update expense_submissions
          set expense_data = ${expenseData}
          where id = ${params.id} and status = 'pending' and scholar_key = ${scholarKey}
          returning *
        `;

  const [row] = rows;
  if (!row) return json({ error: 'Not found or no longer editable' }, { status: 404 });
  return json(row);
});
