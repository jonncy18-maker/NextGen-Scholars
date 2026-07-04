import { sql } from '../../../../../lib/db.js';
import { requireScholarOwn } from '../../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../../lib/http.js';

// Mirrors the inline row-edit update in EnglishSection.jsx / EnglishTracking.jsx
// (date, duration_minutes, activity_type, notes — same field set both places).
export const PATCH = withErrorHandling(async (request, { params }) => {
  await requireScholarOwn(request);
  const { date, duration_minutes, activity_type, notes } = await request.json();
  const [row] = await sql`
    update english_sessions
    set date = ${date}, duration_minutes = ${duration_minutes}, activity_type = ${activity_type}, notes = ${notes ?? null}
    where id = ${params.id}
    returning *
  `;
  if (!row) return json({ error: 'Not found' }, { status: 404 });
  return json(row);
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  await requireScholarOwn(request);
  await sql`delete from english_sessions where id = ${params.id}`;
  return json({ ok: true });
});
