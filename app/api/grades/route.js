import { sql } from '../../../lib/db.js';
import { requireScholarOwn, AuthError } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';

// GET ?scholar= — mentor: all rows if omitted, scoped if given (GradesSection
// loads unscoped; GradeEntry.jsx loads scoped). Scholar role is always
// scoped to their own key regardless of the param.
export const GET = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const { searchParams } = new URL(request.url);
  const scholar = role === 'mentor' ? searchParams.get('scholar') : scholarKey;

  const rows = scholar
    ? await sql`select * from grade_entries where scholar = ${scholar} order by sem, created_at`
    : await sql`select * from grade_entries order by scholar, sem, created_at`;
  return json(rows);
});

const COLS = ['scholar', 'sem', 'school', 'subject', 'units', 'prelim', 'midterm', 'final_grade', 'period_avg', 'pct_equiv'];

function rowValues(g, fallbackScholar) {
  return [
    g.scholar || fallbackScholar, g.sem, g.school || 'uv', g.subject, g.units || 3,
    g.prelim ?? null, g.midterm ?? null, g.final_grade ?? null, g.period_avg ?? null, g.pct_equiv ?? null,
  ];
}

// Body is either a single grade-entry object or { entries: [...] } for the
// bulk AI-ingest / import paths (period_avg/pct_equiv always computed
// client-side before this call — never derived server-side, matching the
// original supabase.from('grade_entries').insert() call sites).
export const POST = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const body = await request.json();
  const list = Array.isArray(body.entries) ? body.entries : [body];

  if (role !== 'mentor') {
    for (const g of list) {
      if (g.scholar && g.scholar !== scholarKey) throw new AuthError(403, 'Cannot write grades for another scholar');
    }
  }

  const placeholders = list.map((_, i) =>
    `(${COLS.map((_, j) => `$${i * COLS.length + j + 1}`).join(', ')})`
  ).join(', ');
  const values = list.flatMap(g => rowValues(g, scholarKey));

  const rows = await sql.query(
    `insert into grade_entries (${COLS.join(', ')}) values ${placeholders} returning *`,
    values
  );
  return json(list.length === 1 ? rows[0] : rows, { status: 201 });
});

// DELETE ?scholar=&sem= — bulk delete a whole semester's grades (GradesSection).
export const DELETE = withErrorHandling(async (request) => {
  await requireScholarOwn(request);
  const { searchParams } = new URL(request.url);
  const scholar = searchParams.get('scholar');
  const sem = searchParams.get('sem');
  if (!scholar || !sem) return json({ error: 'scholar and sem required' }, { status: 400 });
  await sql`delete from grade_entries where scholar = ${scholar} and sem = ${sem}`;
  return json({ ok: true });
});
