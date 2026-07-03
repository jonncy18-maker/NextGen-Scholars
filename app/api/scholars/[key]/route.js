import { sql } from '../../../../lib/db.js';
import { requireMentor } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

// Mirrors writeSemester(scholar, sem).
export const PATCH = withErrorHandling(async (request, { params }) => {
  await requireMentor(request);
  const { sem } = await request.json();
  const [row] = await sql`
    update scholars set current_sem = ${sem} where scholar_key = ${params.key} returning *
  `;
  if (!row) return json({ error: 'Not found' }, { status: 404 });
  return json(row);
});
