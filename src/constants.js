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
  'Flights', 'Hotel & Accommodation', 'Meals & Dining',
  'Activities & Tours', 'Visa & Documents', 'Local Transport',
  'Device & Electronics', 'Equipment', 'Infrastructure',
];

// Category dropdowns for the mentor expense drawer, per bucket.
export const TRAVEL_CATS = [
  'Flights', 'Hotel & Accommodation', 'Meals & Dining',
  'Activities & Tours', 'Visa & Documents', 'Local Transport',
];
export const MILESTONE_CATS = [
  'Milestones', 'Device & Electronics', 'Equipment', 'Motor', 'Infrastructure',
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
  'Milestones':             'milestone',
  'Motor':                  'milestone',
  'Living Expenses':        'life',
  'Flights':                'travel',
  'Hotel & Accommodation':  'travel',
  'Meals & Dining':         'travel',
  'Activities & Tours':     'travel',
  'Visa & Documents':       'travel',
  'Local Transport':        'travel',
  'Device & Electronics':   'milestone',
  'Equipment':              'milestone',
  'Infrastructure':         'milestone',
};

// English session types and their practice categories.
// session_type is stored on english_periods; activity_type is stored on english_sessions.
export const SESSION_TYPES = [
  { key: 'summer_bootcamp', label: 'Summer Bootcamp' },
  { key: 'oet_prep',        label: 'OET Prep' },
];

export const SESSION_CATEGORIES = {
  summer_bootcamp: ['Free Conversation', 'Travel', 'Visa Interview', 'Medical English'],
  oet_prep:        ['Reading', 'Listening', 'Writing', 'Speaking'],
  default:         ['Speaking', 'Listening', 'Reading', 'Writing', 'Other'],
};

// Synonyms that should resolve onto a canonical category when that category is
// present in the active period's set. Keys are normalized (lowercased, trimmed).
// Lets a session stored under a generic skill name (e.g. "Speaking" from the
// default/OET set, or a casing/spacing variant) classify into the right bucket
// instead of falling through to "Other".
const CATEGORY_ALIASES = {
  'speaking':          'Free Conversation',
  'conversation':      'Free Conversation',
  'free convo':        'Free Conversation',
  'travel':            'Travel',
  'travel english':    'Travel',
  'visa':              'Visa Interview',
  'interview':         'Visa Interview',
  'medical':           'Medical English',
  'medical vocab':     'Medical English',
};

// Resolve a session's stored activity_type to one of the period's categories.
// Tries: exact match → case/whitespace-insensitive match → synonym alias.
// Returns 'Other' when nothing matches.
export function classifyActivity(activityType, cats) {
  if (!activityType) return 'Other';
  if (cats.includes(activityType)) return activityType;
  const norm = String(activityType).trim().toLowerCase();
  const ci = cats.find(c => c.toLowerCase() === norm);
  if (ci) return ci;
  const alias = CATEGORY_ALIASES[norm];
  if (alias && cats.includes(alias)) return alias;
  return 'Other';
}

// Scholar name → CSS modifier class. Keys are lowercase to match data keys.
export const NAMECLASS = { claire: '', april: 't-april', janndilyne: 't-janndilyne' };

export const AVB_OPTIONS = ['Actual', 'Budget'];

export const SEMESTER_OPTIONS = [
  'TG11S1', 'TG11S2',
  'TG12S1', 'TG12S2',
  'Y1S1',   'Y1S2',
  'Y2S1',   'Y2S2',
  'Y3S1',   'Y3S2',
  'Y4S1',   'Y4S2',
  'PostY1', 'PostY2', 'PostY3', 'PostY4',
];
