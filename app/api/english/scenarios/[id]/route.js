import { sql } from '../../../../../lib/db.js';
import { requireScholarOwn } from '../../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// Mirrors deleteEnglishScenario(id).
//
// requireScholarOwn() only proves the caller is *a* scholar — it does not scope
// the row, so a non-mentor caller is pinned to their own scholar key here.
// Idempotent (no 404 on a missing row), matching the previous behavior — a
// scholar aiming at another scholar's scenario simply deletes nothing.
export const DELETE = withErrorHandling(async (request, { params }) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  if (role === 'mentor') {
    await sql`delete from english_scenarios where id = ${params.id}`;
  } else {
    await sql`delete from english_scenarios where id = ${params.id} and scholar = ${scholarKey}`;
  }
  return json({ ok: true });
});
