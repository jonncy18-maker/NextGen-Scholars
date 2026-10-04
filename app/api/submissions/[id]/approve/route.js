import { requireMentor } from '../../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../../lib/http.js';
import { approveSubmission, ApprovalError } from '../../../../../lib/approve-submission.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// Old approveSubmission() ran writeExpense() then the status update as two
// separate Supabase calls (non-atomic — a failure between them left an
// orphaned submission). The claim and the insert now run as one SQL statement
// built from the claimed row — see lib/approve-submission.js, which this route
// shares with the approve_submission agent tool.
export const POST = withErrorHandling(async (request, { params }) => {
  const { id: submissionId } = await params;
  await requireMentor(request);
  try {
    return json(await approveSubmission(submissionId));
  } catch (err) {
    if (err instanceof ApprovalError) return json({ error: err.message }, { status: err.status });
    throw err;
  }
});
