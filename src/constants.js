export const JOURNEY_STAGES = [
  { label: 'High school',             detail: 'Identification, family interview, trial period',                        href: '#journey-stage-0' },
  { label: 'University / Bootcamp',   detail: 'Full tuition + board, monthly check-ins',                               href: '#journey-stage-1' },
  { label: 'Licensure',               detail: 'PRC board / TESDA NC II / NCLEX-USA',                                   href: '#journey-stage-2' },
  { label: 'Domestic Placement',      detail: 'PH hospital rotation or luxury hotel',                                  href: '#journey-stage-3' },
  { label: 'International Placement', detail: 'USA hospital, Australian hospital, or international cruise contract',   href: '#journey-stage-4' },
];

export const EXPENSE_CATS = [
  'Tuition', 'Enrollment', 'Uniforms', 'Books', 'Living Expenses',
  'Printing & Research', 'School Supplies', 'Activities',
  'Medical Equipment', 'Motor', 'Milestones', 'Other',
];

export const EXPENSE_BUCKETS = [
  { key: 'college',      label: 'College' },
  { key: 'milestone',    label: 'Milestone' },
  { key: 'travel',       label: 'Travel' },
  { key: 'life',         label: 'Life' },
  { key: 'exam',         label: 'Exam' },
  { key: 'professional', label: 'Professional' },
  { key: 'admin',        label: 'Admin' },
];

// Determines the default bucket for a given expense category.
// Motor is a milestone reward (motorcycle); Milestones cat tracks reward disbursements.
export const CAT_TO_BUCKET = {
  'Tuition':             'college',
  'Enrollment':          'college',
  'Uniforms':            'college',
  'Books':               'college',
  'Printing & Research': 'college',
  'School Supplies':     'college',
  'Activities':          'college',
  'Medical Equipment':   'college',
  'Other':               'college',
  'Milestones':          'milestone',
  'Motor':               'milestone',
  'Living Expenses':     'life',
};

// Scholar name → CSS modifier class. Keys are lowercase to match data keys.
export const NAMECLASS = { claire: '', april: 't-april', aljane: 't-aljane' };

export const AVB_OPTIONS = ['Actual', 'Budget'];

export const SEMESTER_OPTIONS = [
  'T11S1', 'T11S2',
  'T12S1', 'T12S2',
  'Y1S1',  'Y1S2',
  'Y2S1',  'Y2S2',
  'Y3S1',  'Y3S2',
  'Y4S1',  'Y4S2',
  'PostY1', 'PostY2', 'PostY3', 'PostY4',
];
