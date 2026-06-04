// Shared scholar computation helpers used across navigator, claire, and april pages.

export function allExpenses(s) {
  const out = [];
  Object.keys(s.expenses || {}).forEach(sem =>
    (s.expenses[sem] || []).forEach(e => out.push({ ...e, sem, status: e.avb }))
  );
  return out;
}

export function scholarTotals(s) {
  const university = allExpenses(s).reduce((t, e) => t + (e.avb === 'Actual' ? (e.amount || 0) : 0), 0);
  const milestones = (s.milestones || []).reduce((t, m) => t + (m.state === 'done' ? (m.amountPhp || 0) : 0), 0);
  const travel = (s.travels || []).reduce((t, v) => t + (v.state === 'done' ? (v.amountPhp || 0) : 0), 0);
  const allocated = Object.values(s.budgets || {}).reduce((t, v) => t + (typeof v === 'number' ? v : 0), 0);
  return { university, milestones, travel, total: university + milestones + travel, allocated };
}

export function nextMilestone(s) {
  const f = (s.milestones || []).find(m => m.state !== 'done');
  if (!f) return { name: 'All milestones complete', detail: '—' };
  return { name: f.name, detail: f.sem ? 'Expected · ' + f.sem : 'Upcoming' };
}

export function accentFor(s) {
  return s.status === 'active' ? 'gold' : s.status === 'trial' ? 'navy' : 'muted';
}
