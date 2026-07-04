import { sql } from '../../../lib/db.js';
import { requireMentor, requireScholarOwn, AuthError } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';

// GET ?unread=1 — mirrors navigator.jsx's unread activity feed (mentor only).
export const GET = withErrorHandling(async (request) => {
  await requireMentor(request);
  const rows = await sql`
    select * from activity_log where read = false order by created_at desc
  `;
  return json(rows);
});

// Mirrors writeActivityLog({ scholar, type, expense_id, expense_data, changes }).
// POST is scholar-initiated (edit/delete-request logging from entry.jsx);
// mentor may also log on a scholar's behalf.
export const POST = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const body = await request.json();
  const scholar = role === 'mentor' ? body.scholar : scholarKey;
  if (role !== 'mentor' && body.scholar && body.scholar !== scholarKey) {
    throw new AuthError(403, 'Cannot log activity for another scholar');
  }

  const [row] = await sql`
    insert into activity_log (scholar_key, type, expense_id, expense_data, changes)
    values (${scholar}, ${body.type}, ${body.expense_id || null}, ${body.expense_data || null}, ${body.changes || null})
    returning *
  `;
  return json(row, { status: 201 });
});
