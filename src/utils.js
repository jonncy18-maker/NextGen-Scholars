// Shared scholar computation helpers used across navigator, claire, and april pages.

const SEM_LABELS = {
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
