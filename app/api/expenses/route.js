import { sql } from '../../../lib/db.js';
import { requireMentor } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';
import { CAT_TO_BUCKET } from '../../../src/constants.js';

// GET ?scholar=&sem=&bucket= — mirrors MentorExpenseDrawer.jsx's filtered
// select (id, item, cat, amount, date) for one scholar+sem+bucket slice.
// bootstrap already covers the unfiltered "all expenses" case.
export const GET = withErrorHandling(async (request) => {
  await requireMentor(request);
  const { searchParams } = new URL(request.url);
  const scholar = searchParams.get('scholar');
  const sem = searchParams.get('sem');
  const bucket = searchParams.get('bucket');

  const conditions = [];
  const values = [];
  if (scholar) { values.push(scholar); conditions.push(`scholar = $${values.length}`); }
  if (sem)     { values.push(sem);     conditions.push(`sem = $${values.length}`); }
  if (bucket)  { values.push(bucket);  conditions.push(`bucket = $${values.length}`); }
  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';

  const rows = await sql.query(
    `select id, item, cat, amount, date from expenses ${where} order by date asc`,
    values
  );
  return json(rows);
});

// Mirrors src/supabase-writer.js's writeExpense() exactly — same id
// generation fallback, same field defaults.
export const POST = withErrorHandling(async (request) => {
  await requireMentor(request);
  const body = await request.json();
  const { scholar, exp } = body;

  const id = exp.id || `${scholar}_${exp.sem}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const bucket = exp.bucket || CAT_TO_BUCKET[exp.cat] || 'college';

  const [row] = await sql`
    insert into expenses (id, scholar, sem, item, cat, bucket, amount, qty, date, avb, sent, vendor, group_id)
    values (${id}, ${scholar}, ${exp.sem}, ${exp.item}, ${exp.cat}, ${bucket}, ${exp.amount}, ${exp.qty}, ${exp.date}, ${exp.avb}, ${exp.sent}, ${exp.vendor || ''}, ${exp.group_id || null})
    returning *
  `;
  return json(row, { status: 201 });
});
