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
  await requireMentor(request);
  const [sub] = await sql`select * from expense_submissions where id = ${params.id}`;
  if (!sub) return json({ error: 'Not found' }, { status: 404 });

  const scholar = sub.scholar_key;
  const exp = sub.expense_data;
  const id = exp.id || `${scholar}_${exp.sem}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const bucket = exp.bucket || CAT_TO_BUCKET[exp.cat] || 'college';

  const client = sql;
  const [[expenseRow], [submissionRow]] = await client.transaction([
    client`
      insert into expenses (id, scholar, sem, item, cat, bucket, amount, qty, date, avb, sent, vendor, group_id)
      values (${id}, ${scholar}, ${exp.sem}, ${exp.item}, ${exp.cat}, ${bucket}, ${exp.amount}, ${exp.qty}, ${exp.date}, ${exp.avb}, ${exp.sent}, ${exp.vendor || ''}, ${exp.group_id || null})
      returning *
    `,
    client`
      update expense_submissions set status = 'approved', reviewed_at = now()
      where id = ${params.id}
      returning *
    `,
  ]);

  return json({ expense: expenseRow, submission: submissionRow });
});
