import { sql } from '../../../lib/db.js';
import { requireMentor } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request) => {
  await requireMentor(request);
  const rows = await sql`select * from career_steps order by scholar, step`;
  return json(rows);
});

// Mirrors CareerSection.jsx's upsert — onConflict (scholar, step). The only
// write op on this table; no separate insert/update path.
export const PUT = withErrorHandling(async (request) => {
  await requireMentor(request);
  const { scholar, step, status, exam_date, score, notes } = await request.json();
  const [row] = await sql`
    insert into career_steps (scholar, step, status, exam_date, score, notes)
    values (${scholar}, ${step}, ${status}, ${exam_date ?? null}, ${score ?? null}, ${notes ?? null})
    on conflict (scholar, step) do update set
      status = excluded.status, exam_date = excluded.exam_date,
      score = excluded.score, notes = excluded.notes, updated_at = now()
    returning *
  `;
  return json(row);
});
