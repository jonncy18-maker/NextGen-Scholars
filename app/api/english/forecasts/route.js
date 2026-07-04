import { sql } from '../../../../lib/db.js';
import { requireScholarOwn } from '../../../../lib/auth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

export const GET = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const rows = role === 'mentor'
    ? await sql`select * from english_forecasts`
    : await sql`select * from english_forecasts where scholar = ${scholarKey}`;
  return json(rows);
});

const COLS = [
  'scholar', 'period_id', 'actual_hours', 'actual_by_cat', 'expected_hours',
  'pace_hrs_per_week', 'projected_total', 'gap_vs_goal', 'weeks_remaining', 'status',
];

// Mirrors upsertEnglishForecast() — onConflict (scholar, period_id).
export const PUT = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const body = await request.json();
  const scholar = role === 'mentor' ? body.scholar : scholarKey;

  const values = COLS.map(c => (c === 'scholar' ? scholar : body[c] ?? null));
  const updateSet = COLS.filter(c => c !== 'scholar' && c !== 'period_id')
    .map(c => `${c} = excluded.${c}`).join(', ');

  const [row] = await sql.query(
    `insert into english_forecasts (${COLS.join(', ')})
     values (${COLS.map((_, i) => `$${i + 1}`).join(', ')})
     on conflict (scholar, period_id) do update set ${updateSet}, updated_at = now()
     returning *`,
    values
  );
  return json(row);
});
