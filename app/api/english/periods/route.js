import { sql } from '../../../../lib/db.js';
import { requireMentor, requireScholarOwn } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

// GET ?scholar= — mentor: all rows if omitted, scoped if given (NavigatorAI's
// english-hours ingest panel loads one scholar's latest period).
export const GET = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const { searchParams } = new URL(request.url);
  const scholar = role === 'mentor' ? searchParams.get('scholar') : scholarKey;

  const rows = scholar
    ? await sql`select * from english_periods where scholar = ${scholar} order by start_date desc`
    : await sql`select * from english_periods order by start_date desc`;
  return json(rows);
});

// Mirrors EnglishSection.jsx's create-new-period insert.
export const POST = withErrorHandling(async (request) => {
  await requireMentor(request);
  const { scholar, label, session_type, start_date, end_date, hour_goal } = await request.json();
  const [row] = await sql`
    insert into english_periods (scholar, label, session_type, start_date, end_date, hour_goal)
    values (${scholar}, ${label}, ${session_type}, ${start_date}, ${end_date}, ${hour_goal})
    returning *
  `;
  return json(row, { status: 201 });
});
