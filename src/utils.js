// Shared scholar computation helpers used across navigator, claire, and april pages.

const SEM_LABELS = {
  'Entry': 'Entry (Trial Admission)',
  'Trial · G12': 'Trial · Grade 12',
  'Y1S1': 'Year 1 · S1', 'Y1S2': 'Year 1 · S2',
  'Y2S1': 'Year 2 · S1', 'Y2S2': 'Year 2 · S2',
  'Y3S1': 'Year 3 · S1', 'Y3S2': 'Year 3 · S2',
  'Y4S1': 'Year 4 · S1', 'Y4S2': 'Year 4 · S2',
  'TG11S1': 'Grade 11 · S1', 'TG11S2': 'Grade 11 · S2',
  'TG12S1': 'Grade 12 · S1', 'TG12S2': 'Grade 12 · S2',
  'Grade 10': 'Grade 10',
  'G11 S1': 'Grade 11 · S1', 'G11 S2': 'Grade 11 · S2',
  'G12 S1': 'Grade 12 · S1', 'G12 S2': 'Grade 12 · S2',
};

export function semLabel(sem) {
  return SEM_LABELS[sem] || sem;
}

// Converts a Supabase academics array into the display history used by
// publicProfile.academics.history on the scholar profile pages.
export function buildAcademicsHistory(academics) {
  return (academics || [])
    .filter(a => a.status !== 'excluded')
    .map(a => ({
      label:  semLabel(a.sem),
      value:  a.gpa != null ? `${a.gpa}%` : (a.status === 'active' ? 'In progress' : '—'),
      status: a.status,
    }));
}

export function allExpenses(s) {
  const out = [];
  Object.keys(s.expenses || {}).forEach(sem =>
    (s.expenses[sem] || []).forEach(e => out.push({ ...e, sem, status: e.avb }))
  );
  return out;
}

export function scholarTotals(s) {
  const expenses = allExpenses(s);
  const byBucket = {};
  expenses.forEach(e => {
    if (e.avb === 'Budget') return;
    const b = e.bucket || 'college';
    byBucket[b] = (byBucket[b] || 0) + (e.amount || 0) * (e.qty || 1);
  });
  const total = Object.values(byBucket).reduce((t, v) => t + v, 0);
  const allocated = Object.values(s.budgets || {}).reduce((t, v) => t + (typeof v === 'number' ? v : 0), 0);
  return {
    byBucket,
    college:      byBucket.college      || 0,
    milestone:    byBucket.milestone    || 0,
    life:         byBucket.life         || 0,
    travel:       byBucket.travel       || 0,
    exam:         byBucket.exam         || 0,
    professional: byBucket.professional || 0,
    admin:        byBucket.admin        || 0,
    total,
    allocated,
  };
}

export function nextMilestone(s) {
  const f = (s.milestones || []).find(m => m.state !== 'done');
  if (!f) return { name: 'All milestones complete', detail: '—' };
  return { name: f.name, detail: f.sem ? 'Expected · ' + f.sem : 'Upcoming' };
}

export function accentFor(s) {
  return s.status === 'active' ? 'gold' : s.status === 'trial' ? 'navy' : 'muted';
}

// Days since the most recent "Actual" expense entry across all semesters, or
// null if the scholar has never logged one. Used to flag stale/disengaged
// scholars on the Navigator dashboard.
export function daysSinceLastExpense(s) {
  const dates = allExpenses(s).filter(e => e.avb === 'Actual' && e.date).map(e => e.date);
  if (!dates.length) return null;
  const latest = dates.reduce((a, b) => (a > b ? a : b));
  return Math.floor((Date.now() - new Date(latest).getTime()) / 86400000);
}

// Month-over-month "Actual" spend for a scholar, bucketed by calendar month
// (YYYY-MM) so it lines up with how mentors think about a monthly budget.
export function monthlySpendTrend(s) {
  const now = new Date();
  const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  let thisMonth = 0, lastMonth = 0;
  allExpenses(s).forEach(e => {
    if (e.avb !== 'Actual' || !e.date) return;
    const amt = (e.amount || 0) * (e.qty || 1);
    const key = e.date.slice(0, 7);
    if (key === thisKey) thisMonth += amt;
    else if (key === prevKey) lastMonth += amt;
  });
  return { thisMonth, lastMonth };
}
