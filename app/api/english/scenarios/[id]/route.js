import { sql } from '../../../../../lib/db.js';
import { requireScholarOwn } from '../../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../../lib/http.js';

// Mirrors deleteEnglishScenario(id).
export const DELETE = withErrorHandling(async (request, { params }) => {
  await requireScholarOwn(request);
  await sql`delete from english_scenarios where id = ${params.id}`;
  return json({ ok: true });
});
