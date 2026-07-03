import { sql } from '../../../../lib/db.js';
import { requireScholarOwn, AuthError } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

// GET ?scholar=&from=&to=&sem= — mirrors the various direct selects across
// EnglishSection.jsx (mentor, unscoped) and EnglishTracking.jsx (scholar,
// scoped by date range when a period is active, else by sem).
export const GET = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const { searchParams } = new URL(request.url);
  const scholar = role === 'mentor' ? searchParams.get('scholar') : scholarKey;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const sem = searchParams.get('sem');

  const conditions = [];
  const values = [];
  if (scholar) { values.push(scholar); conditions.push(`scholar = $${values.length}`); }
  if (from && to) {
    values.push(from); conditions.push(`date >= $${values.length}`);
    values.push(to); conditions.push(`date <= $${values.length}`);
  } else if (sem) {
    values.push(sem); conditions.push(`sem = $${values.length}`);
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const rows = await sql.query(`select * from english_sessions ${where} order by date desc`, values);
  return json(rows);
});

const COLS = ['scholar', 'sem', 'date', 'duration_minutes', 'activity_type', 'notes', 'category', 'period_id'];

function rowValues(s, fallbackScholar) {
  return [
    s.scholar || fallbackScholar, s.sem ?? null, s.date, s.duration_minutes, s.activity_type,
    s.notes ?? null, s.category || 'conversation', s.period_id ?? null,
  ];
}

// Mirrors both the single-row inserts (EnglishSection/EnglishTracking manual
// add) and the bulk array insert (EnglishIngestPanel AI-parsed sessions) —
// body is either one session object or { sessions: [...] }.
export const POST = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const body = await request.json();
  const list = Array.isArray(body.sessions) ? body.sessions : [body];

  if (role !== 'mentor') {
    for (const s of list) {
      if (s.scholar && s.scholar !== scholarKey) throw new AuthError(403, 'Cannot log sessions for another scholar');
    }
  }

  const placeholders = list.map((_, i) =>
    `(${COLS.map((_, j) => `$${i * COLS.length + j + 1}`).join(', ')})`
  ).join(', ');
  const values = list.flatMap(s => rowValues(s, scholarKey));

  const rows = await sql.query(
    `insert into english_sessions (${COLS.join(', ')}) values ${placeholders} returning *`,
    values
  );
  return json(list.length === 1 ? rows[0] : rows, { status: 201 });
});
