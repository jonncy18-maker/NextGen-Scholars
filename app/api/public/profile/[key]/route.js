import { sql } from '../../../../../lib/db.js';
import { json, withErrorHandling } from '../../../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// Public, unauthenticated — backs the public profile pages (claire.jsx,
// april.jsx, janndilyne.jsx via useScholarProfile.js) and the homepage
// scholar cards. This is a curated whitelist, NOT a passthrough: it must
// never return raw expense rows, mentor notes, alerts, submissions, or
// activity — anyone on the internet can call this with no login. Financial
// detail is aggregated server-side into bucket totals only.
const PUBLIC_SCHOLARS = new Set(['claire', 'april', 'janndilyne']);

function today() { return new Date().toISOString().slice(0, 10); }

// Mirrors src/utils.js's scholarTotals()/allExpenses() bucket logic exactly,
// so the public totals match what the mentor console computes.
function aggregateInvestment(expenseRows, budgetRows) {
  const byBucket = {};
  expenseRows.forEach(e => {
    if (e.avb === 'Budget') return;
    const bucket = e.bucket || 'college';
    byBucket[bucket] = (byBucket[bucket] || 0) + Number(e.amount || 0) * Number(e.qty || 1);
  });
  const total = Object.values(byBucket).reduce((t, v) => t + v, 0);
  const allocated = budgetRows.reduce((t, b) => t + Number(b.amount_php || 0), 0);
  return {
    investmentTotals: {
      total,
      college: byBucket.college || 0,
      milestone: byBucket.milestone || 0,
      life: byBucket.life || 0,
      travel: byBucket.travel || 0,
      exam: byBucket.exam || 0,
      professional: byBucket.professional || 0,
      admin: byBucket.admin || 0,
    },
    allocated,
  };
}

export const GET = withErrorHandling(async (request, { params }) => {
  const key = params.key;
  if (!PUBLIC_SCHOLARS.has(key)) return json({ error: 'Not found' }, { status: 404 });

  const [
    [scholarRow],
    academics,
    milestones,
    travels,
    expenseRows,
    budgetRows,
    periods,
  ] = await Promise.all([
    sql`select current_sem, gpa_floor from scholars where scholar_key = ${key}`,
    sql`select sem, gpa, status from academics where scholar = ${key} order by id`,
    sql`select name, sem, state from milestones where scholar = ${key} order by id`,
    sql`select dest, sem, state from travels where scholar = ${key} order by id`,
    sql`select amount, qty, cat, bucket, avb from expenses where scholar = ${key}`,
    sql`select amount_php from budgets where scholar = ${key}`,
    sql`select * from english_periods where scholar = ${key} and start_date <= ${today()} and end_date >= ${today()} order by start_date desc limit 1`,
  ]);

  const { investmentTotals, allocated } = aggregateInvestment(expenseRows, budgetRows);

  let englishHours = null;
  const period = periods[0];
  if (period) {
    const sessions = await sql`
      select duration_minutes from english_sessions
      where scholar = ${key} and date >= ${period.start_date} and date <= ${period.end_date}
    `;
    const mins = sessions.reduce((s, r) => s + (r.duration_minutes || 0), 0);
    englishHours = { hours: Math.round((mins / 60) * 10) / 10, goal: Number(period.hour_goal) };
  }

  return json({
    currentSem: scholarRow?.current_sem ?? null,
    gpaFloor: scholarRow?.gpa_floor != null ? Number(scholarRow.gpa_floor) : null,
    academics: academics.map(a => ({ sem: a.sem, gpa: a.gpa != null ? Number(a.gpa) : null, status: a.status })),
    milestones: milestones.map(m => ({ name: m.name, sem: m.sem, state: m.state })),
    travels: travels.map(t => ({ dest: t.dest, sem: t.sem, state: t.state })),
    investmentTotals,
    allocated,
    englishHours,
  });
});
