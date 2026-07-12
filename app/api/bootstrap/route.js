import { sql } from '../../../lib/db.js';
import { requireScholarOwn } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

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

  // TEMP DIAGNOSTIC (2026-07-12): the mentor dashboard is showing an old
  // expense snapshot while the public endpoint on the same DB/deploy returns
  // fresh data. Log exactly what THIS authenticated request pulled so we can
  // see server-side whether the vaccines/mark-sent are present. Remove once
  // the stale-bootstrap cause is found.
  try {
    const exp = payload.expenses || [];
    const claire = exp.filter(e => e.scholar === 'claire');
    const vaccineBatch = claire.filter(e => String(e.id).includes('1783578173158'));
    const claireCollegeSent = claire.filter(e => e.cat === 'Tuition');
    // Parse the connection string so we can compare the exact DB the app reads
    // (host + database name + whether it's the -pooler endpoint) against where
    // the real data lives (patient-flower / neondb / br-green-dust). The 8
    // missing vaccine rows mean these are almost certainly NOT the same DB.
    const rawUrl = process.env.DATABASE_URL || '';
    let dbHost = 'unknown', dbName = 'unknown';
    try {
      const u = new URL(rawUrl);
      dbHost = u.host;
      dbName = u.pathname.replace(/^\//, '') || 'unknown';
    } catch {
      dbHost = rawUrl.replace(/:\/\/[^@]*@/, '://***@').split('/')[2] || 'unknown';
    }
    console.log('BOOTSTRAP_PROBE', JSON.stringify({
      role,
      scopeKey,
      dbHost,
      dbName,
      isPooler: dbHost.includes('-pooler'),
      totalExpenses: exp.length,
      claireExpenses: claire.length,
      vaccineBatchRows: vaccineBatch.length,
      vaccineItems: vaccineBatch.map(e => e.item),
      tuitionSentStates: claireCollegeSent.map(e => `${e.item}=${e.sent}`),
    }));
  } catch (e) {
    console.log('BOOTSTRAP_PROBE_ERROR', e?.message);
  }

  return json(payload);
});
