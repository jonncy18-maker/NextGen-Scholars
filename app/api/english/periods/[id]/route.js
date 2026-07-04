import { sql } from '../../../../../lib/db.js';
import { requireMentor } from '../../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../../lib/http.js';

const ALLOWED_FIELDS = [
  'scholar', 'label', 'session_type', 'start_date', 'end_date', 'hour_goal',
  'category_goals', 'weekly_target_hours', 'weekly_target_by_category',
];

// Generic field-subset update — covers the full-edit form, the category-goals-
// only form, and updatePeriodWeeklyTargets() (weekly_target_hours +
// weekly_target_by_category), all of which just PATCH a different field subset.
export const PATCH = withErrorHandling(async (request, { params }) => {
  await requireMentor(request);
  const fields = await request.json();
  const keys = Object.keys(fields).filter(k => ALLOWED_FIELDS.includes(k));
  if (!keys.length) return json({ error: 'No valid fields to update' }, { status: 400 });

  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map(k => fields[k]);
  const [row] = await sql.query(
    `update english_periods set ${setClause} where id = $1 returning *`,
    [params.id, ...values]
  );
  if (!row) return json({ error: 'Not found' }, { status: 404 });
  return json(row);
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  await requireMentor(request);
  await sql`delete from english_periods where id = ${params.id}`;
  return json({ ok: true });
});
