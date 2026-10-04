// Approving a pending expense submission — shared by the approve route
// (app/api/submissions/[id]/approve) and the approve_submission agent tool
// (lib/ai/tools.js) so the two surfaces cannot drift apart.
//
// Two rules hold this together:
//
// 1. The expense is built from the CLAIMED row, inside the same statement that
//    claims it. A scholar can PATCH a pending submission at any moment; if the
//    values were read earlier and re-sent as parameters, an edit landing
//    between the read and the claim would be marked approved while the stale
//    contents were saved. Selecting from `claimed.expense_data` means the saved
//    expense is always exactly the row that was approved.
// 2. `bucket` is derived from the category (CAT_TO_BUCKET), never taken from
//    expense_data — a scholar-supplied bucket would let her file spending under
//    a bucket the public profile pages publish. The category is checked against
//    EXPENSE_CATS in SQL too (not just on the pre-read), so a concurrent edit
//    to an invalid category cannot slip past the fast check.

import { sql } from './db.js';
import { CAT_TO_BUCKET, EXPENSE_CATS } from '../src/constants.js';

export class ApprovalError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const badCat = (cat) =>
  new ApprovalError(400, `Unknown category "${cat ?? ''}" — fix the submission's category before approving.`);

/**
 * @returns {Promise<{ expense: object, submission: object }>}
 * @throws {ApprovalError} 404 no such submission, 409 no longer pending,
 *   400 invalid category.
 */
export async function approveSubmission(submissionId) {
  // Fast check only — the authoritative checks run inside the claim below.
  const [pre] = await sql`select status, expense_data->>'cat' as cat from expense_submissions where id = ${submissionId}`;
  if (!pre) throw new ApprovalError(404, 'Not found');
  if (pre.status !== 'pending') throw new ApprovalError(409, 'Submission is no longer pending');
  if (!EXPENSE_CATS.includes(pre.cat)) throw badCat(pre.cat);

  // Used only when expense_data carries no id of its own; the scholar and
  // semester halves of the generated id come from the claimed row in SQL.
  const idSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Claim and insert in one SQL statement: concurrent approvals re-check the
  // pending predicate after the row lock, and only the winner inserts.
  const [result] = await sql`
    with claimed as (
      update expense_submissions set status = 'approved', reviewed_at = now()
      where id = ${submissionId} and status = 'pending'
        and expense_data->>'cat' in (select jsonb_array_elements_text(${JSON.stringify(EXPENSE_CATS)}::jsonb))
      returning *
    ), inserted as (
      insert into expenses (id, scholar, sem, item, cat, bucket, amount, qty, date, avb, sent, vendor, group_id)
      select coalesce(nullif(claimed.expense_data->>'id', ''),
                      claimed.scholar_key || '_' || (claimed.expense_data->>'sem') || '_' || ${idSuffix}),
             claimed.scholar_key,
             claimed.expense_data->>'sem',
             claimed.expense_data->>'item',
             claimed.expense_data->>'cat',
             coalesce(${JSON.stringify(CAT_TO_BUCKET)}::jsonb ->> (claimed.expense_data->>'cat'), 'college'),
             nullif(claimed.expense_data->>'amount', '')::numeric,
             nullif(claimed.expense_data->>'qty', '')::numeric,
             claimed.expense_data->>'date',
             claimed.expense_data->>'avb',
             claimed.expense_data->>'sent',
             coalesce(claimed.expense_data->>'vendor', ''),
             nullif(claimed.expense_data->>'group_id', '')
      from claimed
      returning *
    )
    select row_to_json(inserted) as expense, row_to_json(claimed) as submission
    from inserted cross join claimed
  `;
  if (result) return { expense: result.expense, submission: result.submission };

  // Nothing claimed: either it stopped being pending, or a concurrent edit left
  // it with a category outside EXPENSE_CATS.
  const [now] = await sql`select status, expense_data->>'cat' as cat from expense_submissions where id = ${submissionId}`;
  if (now && now.status === 'pending') throw badCat(now.cat);
  throw new ApprovalError(409, 'Submission is no longer pending');
}
