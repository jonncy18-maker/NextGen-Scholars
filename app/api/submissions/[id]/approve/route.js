import { sql } from '../../../../../lib/db.js';
import { requireMentor } from '../../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../../lib/http.js';
import { CAT_TO_BUCKET } from '../../../../../src/constants.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// Old approveSubmission() ran writeExpense() then the status update as two
// separate Supabase calls (non-atomic — a failure between them left an
// orphaned submission). Here both run in one Neon transaction() batch.
export const POST = withErrorHandling(async (request, { params }) => {
  const { id: submissionId } = await params;
  await requireMentor(request);
  const [sub] = await sql`select * from expense_submissions where id = ${submissionId}`;
  if (!sub) return json({ error: 'Not found' }, { status: 404 });

  const scholar = sub.scholar_key;
  const exp = sub.expense_data;
  const id = exp.id || `${scholar}_${exp.sem}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const bucket = exp.bucket || CAT_TO_BUCKET[exp.cat] || 'college';

  const client = sql;
  // Claim and insert in one SQL statement: concurrent approvals re-check the
  // pending predicate after the row lock, and only the winner inserts.
  const [[result]] = await client.transaction([
    client`
      with claimed as (
        update expense_submissions set status = 'approved', reviewed_at = now()
        where id = ${submissionId} and status = 'pending'
        returning *
      ), inserted as (
        insert into expenses (id, scholar, sem, item, cat, bucket, amount, qty, date, avb, sent, vendor, group_id)
        select ${id}, ${scholar}, ${exp.sem}, ${exp.item}, ${exp.cat}, ${bucket}, ${exp.amount}, ${exp.qty}, ${exp.date}, ${exp.avb}, ${exp.sent}, ${exp.vendor || ''}, ${exp.group_id || null}
        from claimed
        returning *
      )
      select row_to_json(inserted) as expense, row_to_json(claimed) as submission
      from inserted cross join claimed
    `,
  ]);
  if (!result) return json({ error: 'Submission is no longer pending' }, { status: 409 });
  const { expense: expenseRow, submission: submissionRow } = result;

  return json({ expense: expenseRow, submission: submissionRow });
});
