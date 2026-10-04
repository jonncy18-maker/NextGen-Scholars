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
// original 'resubmitted' and creates a new pending row in one atomic
// statement) — body's optional `resubmitOf` selects the latter behavior.
export const POST = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const body = await request.json();
  const { expenseData, resubmitOf } = body;
  const scholar = role === 'mentor' ? body.scholar : scholarKey;
  if (!scholar) return json({ error: 'scholar required' }, { status: 400 });
  if (!expenseData || typeof expenseData !== 'object' || Array.isArray(expenseData)) {
    return json({ error: 'expenseData must be an object' }, { status: 400 });
  }

  if (resubmitOf) {
    // Supersede the original and insert its replacement in ONE statement: the
    // insert selects from the CTE's RETURNING, so it only happens if the
    // original was actually claimed, and a failed insert rolls the claim back
    // (a single statement is atomic) instead of hiding the original with no
    // replacement. Scoped to the target scholar's own rows — for a scholar
    // that is her own key, so one scholar cannot supersede another's
    // submission and silently pull it out of the mentor's review queue.
    //
    // Only a *rejected* original can be resubmitted: that is the one flow the
    // client offers (Edit & Resubmit on a rejected row; pending rows are edited
    // in place via PATCH). Not requiring 'pending' keeps that flow working,
    // while excluding 'approved' (it already became an expense — a second
    // submission would be a duplicate) and 'resubmitted' (already superseded —
    // a double-tap or retry must not spawn a second replacement).
    //
    // The casts matter: parameters in an INSERT ... SELECT list are inferred
    // as text, which Postgres will not assign to a jsonb column.
    const [row] = await sql`
      with orig as (
        update expense_submissions set status = 'resubmitted'
        where id = ${resubmitOf} and scholar_key = ${scholar} and status = 'rejected'
        returning id
      )
      insert into expense_submissions (scholar_key, expense_data, status)
      select ${scholar}::text, ${expenseData}::jsonb, 'pending' from orig
      returning *
    `;
    if (!row) return json({ error: 'Original submission not found' }, { status: 404 });
    return json(row, { status: 201 });
  }

  const [row] = await sql`
    insert into expense_submissions (scholar_key, expense_data, status)
    values (${scholar}, ${expenseData}, 'pending')
    returning *
  `;
  return json(row, { status: 201 });
});
