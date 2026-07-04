import { sql } from '../../../lib/db.js';
import { requireScholarOwn } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';

// Replaces supabase-loader.js's 10-way Promise.all of select('*') — one
// query batch, one JSON payload keyed by table name with raw rows. The
// frontend's existing NGS_DATA merge logic (num/maybeNum coercion, per-
// scholar assembly) is unchanged; it just gets its rows from here instead
// of from Supabase.
const SCHOLAR_SCOPED = {
  academics: 'scholar',
  milestones: 'scholar',
  travels: 'scholar',
  budgets: 'scholar',
  expenses: 'scholar',
  alerts: 'scholar',
  deadlines: 'scholar',
  actions: 'scholar',
};

async function fetchTable(table, { scholarKey }) {
  const scopeCol = SCHOLAR_SCOPED[table];
  if (table === 'config') return sql`select key, value from config`;
  if (table === 'scholars') {
    return scholarKey
      ? sql`select * from scholars where scholar_key = ${scholarKey}`
      : sql`select * from scholars`;
  }
  if (scopeCol && scholarKey) {
    return sql.query(`select * from ${table} where ${scopeCol} = $1`, [scholarKey]);
  }
  return sql.query(`select * from ${table}`, []);
}

const ALL_TABLES = [
  'config', 'scholars', 'academics', 'milestones', 'travels',
  'budgets', 'expenses', 'alerts', 'deadlines', 'actions',
];

export const GET = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const scopeKey = role === 'scholar' ? scholarKey : null;

  const { searchParams } = new URL(request.url);
  const requested = searchParams.get('tables');
  const tables = requested
    ? requested.split(',').filter(t => ALL_TABLES.includes(t))
    : ALL_TABLES;

  const results = await Promise.all(
    tables.map(t => fetchTable(t, { scholarKey: scopeKey }))
  );

  const payload = { role };
  tables.forEach((t, i) => { payload[t] = results[i]; });
  return json(payload);
});
