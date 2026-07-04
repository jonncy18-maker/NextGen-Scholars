import { sql } from '../../../../../lib/db.js';
import { requireScholarOwn } from '../../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// Mirrors deleteEnglishScenario(id).
export const DELETE = withErrorHandling(async (request, { params }) => {
  await requireScholarOwn(request);
  await sql`delete from english_scenarios where id = ${params.id}`;
  return json({ ok: true });
});
