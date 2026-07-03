import { sql } from '../../../lib/db.js';
import { requireScholarOwn } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';

// Replaces the 9 Supabase realtime channels. Client polls this on an
// interval + on focus + after its own writes, passing back the `now` this
// endpoint returned last time as `since`. `ids` (all current ids, not just
// changed ones) lets the client reconcile deletes without a tombstone table
// — fine at this app's scale (a few hundred rows per table, max).
const POLLED = {
  alerts:              'scholar',
  activity_log:        'scholar_key',
  expense_submissions: 'scholar_key',
  grade_entries:       'scholar',
  expenses:             'scholar',
  documents:            'scholar',
  career_steps:         'scholar',
};

async function fetchChanges(table, scopeCol, { since, scholarKey }) {
  const idCol = 'id';
  if (scholarKey) {
    const rows = await sql.query(
      `select * from ${table} where ${scopeCol} = $1 and updated_at > $2`,
      [scholarKey, since]
    );
    const idRows = await sql.query(
      `select ${idCol} from ${table} where ${scopeCol} = $1`,
      [scholarKey]
    );
    return { rows, ids: idRows.map(r => r[idCol]) };
  }
  const rows = await sql.query(`select * from ${table} where updated_at > $1`, [since]);
  const idRows = await sql.query(`select ${idCol} from ${table}`, []);
  return { rows, ids: idRows.map(r => r[idCol]) };
}

export const GET = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  const scopeKey = role === 'scholar' ? scholarKey : null;

  const { searchParams } = new URL(request.url);
  const since = searchParams.get('since') || new Date(0).toISOString();
  const now = new Date().toISOString();

  const entries = Object.entries(POLLED);
  const results = await Promise.all(
    entries.map(([table, col]) => fetchChanges(table, col, { since, scholarKey: scopeKey }))
  );

  const tables = {};
  entries.forEach(([table], i) => { tables[table] = results[i]; });
  return json({ now, tables });
});
