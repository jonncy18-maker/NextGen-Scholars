import { sql } from '../../../../lib/db.js';
import { requireScholarOwn } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const rows = role === 'mentor'
    ? await sql`select * from english_scenarios order by created_at desc`
    : await sql`select * from english_scenarios where scholar = ${scholarKey} order by created_at desc`;
  return json(rows);
});

// Mirrors saveEnglishScenario(scenario) — update if body.id present, else insert.
export const POST = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const body = await request.json();
  const scholar = role === 'mentor' ? body.scholar : scholarKey;

  if (body.id) {
    const [row] = await sql`
      update english_scenarios set
        period_id = ${body.period_id}, name = ${body.name}, description = ${body.description ?? null},
        additional_hrs_per_week = ${body.additional_hrs_per_week}, additional_by_category = ${body.additional_by_category ?? null},
        projected_total = ${body.projected_total ?? null}, projected_completion_date = ${body.projected_completion_date ?? null},
        gap_vs_goal = ${body.gap_vs_goal ?? null}, updated_at = now()
      where id = ${body.id}
      returning *
    `;
    if (!row) return json({ error: 'Not found' }, { status: 404 });
    return json(row);
  }

  const [row] = await sql`
    insert into english_scenarios
      (scholar, period_id, name, description, additional_hrs_per_week, additional_by_category, projected_total, projected_completion_date, gap_vs_goal)
    values
      (${scholar}, ${body.period_id}, ${body.name}, ${body.description ?? null}, ${body.additional_hrs_per_week}, ${body.additional_by_category ?? null}, ${body.projected_total ?? null}, ${body.projected_completion_date ?? null}, ${body.gap_vs_goal ?? null})
    returning *
  `;
  return json(row, { status: 201 });
});
