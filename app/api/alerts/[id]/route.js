import { sql } from '../../../../lib/db.js';
import { requireMentor } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

// Mirrors navigator.jsx's handleDismissDbAlert().
export const DELETE = withErrorHandling(async (request, { params }) => {
  await requireMentor(request);
  await sql`delete from alerts where id = ${params.id}`;
  return json({ ok: true });
});
