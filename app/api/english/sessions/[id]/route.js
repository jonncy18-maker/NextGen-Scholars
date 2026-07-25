import { sql } from '../../../../../lib/db.js';
import { requireScholarOwn } from '../../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// Mirrors the inline row-edit update in EnglishSection.jsx / EnglishTracking.jsx
// (date, duration_minutes, activity_type, notes — same field set both places).
//
// requireScholarOwn() only proves the caller is *a* scholar — it does not scope
// the row, so both handlers pin non-mentor callers to their own scholar key.
// Otherwise any signed-in scholar could edit or delete another scholar's
// logged sessions by id.
export const PATCH = withErrorHandling(async (request, { params }) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const { date, duration_minutes, activity_type, notes } = await request.json();
  const rows = role === 'mentor'
    ? await sql`
        update english_sessions
        set date = ${date}, duration_minutes = ${duration_minutes}, activity_type = ${activity_type}, notes = ${notes ?? null}
        where id = ${params.id}
        returning *
      `
    : await sql`
        update english_sessions
        set date = ${date}, duration_minutes = ${duration_minutes}, activity_type = ${activity_type}, notes = ${notes ?? null}
        where id = ${params.id} and scholar = ${scholarKey}
        returning *
      `;
  const [row] = rows;
  if (!row) return json({ error: 'Not found' }, { status: 404 });
  return json(row);
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  // Idempotent (no 404 on a missing row), matching the previous behavior — a
  // scholar aiming at someone else's row simply deletes nothing.
  if (role === 'mentor') {
    await sql`delete from english_sessions where id = ${params.id}`;
  } else {
    await sql`delete from english_sessions where id = ${params.id} and scholar = ${scholarKey}`;
  }
  return json({ ok: true });
});
