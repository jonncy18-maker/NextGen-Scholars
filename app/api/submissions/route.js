import { sql } from '../../../lib/db.js';
import { requireMentor, requireScholarOwn, AuthError } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// GET ?status=pending  → mentor, mirrors loadPendingSubmissions()
// GET ?mine            → scholar's own, mirrors loadScholarSubmissions()
//   (excludes 'approved' and 'resubmitted', matching the original .not() chain)
export const GET = withErrorHandling(async (request) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const mine = searchParams.get('mine');

  if (status === 'pending') {
    await requireMentor(request);
    const rows = await sql`
      select * from expense_submissions where status = 'pending' order by created_at desc
    `;
    return json(rows);
  }

  if (mine) {
    const { role, scholarKey } = await requireScholarOwn(request);
    if (role !== 'mentor' && !scholarKey) throw new AuthError(403, 'No scholar_key on profile');
    const rows = await sql`
      select * from expense_submissions
      where scholar_key = ${scholarKey}
        and status not in ('approved', 'resubmitted')
      order by created_at desc
    `;
    return json(rows);
  }

  return json({ error: 'Specify ?status=pending or ?mine' }, { status: 400 });
});

// Mirrors writeSubmission() (plain create) and resubmitExpense() (marks the
// original 'resubmitted' first, then creates a new pending row) — body's
// optional `resubmitOf` selects the latter behavior.
export const POST = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const body = await request.json();
  const { expenseData, resubmitOf } = body;
  const scholar = role === 'mentor' ? body.scholar : scholarKey;
  if (!scholar) return json({ error: 'scholar required' }, { status: 400 });

  if (resubmitOf) {
    await sql`update expense_submissions set status = 'resubmitted' where id = ${resubmitOf}`;
  }

  const [row] = await sql`
    insert into expense_submissions (scholar_key, expense_data, status)
    values (${scholar}, ${expenseData}, 'pending')
    returning *
  `;
  return json(row, { status: 201 });
});
