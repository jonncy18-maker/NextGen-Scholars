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
  'Entry',
  'TG11S1', 'TG11S2',
  'TG12S1', 'TG12S2',
  'Y1S1',   'Y1S2',
  'Y2S1',   'Y2S2',
  'Y3S1',   'Y3S2',
  'Y4S1',   'Y4S2',
  'PostY1', 'PostY2', 'PostY3', 'PostY4',
];

// ── Scholar living budget (/budget/:scholar) ────────────────────────────────
// These are for the SCHOLAR'S OWN living-expense budget — her allowance and how
// she spends it. They are NOT related to EXPENSE_CATS above, which are the
// mentor's sponsor categories (Tuition, Uniforms, Books), nor to the `budgets`
// table, which is the program's per-semester scholarship budget. See
// db/living_budget.sql for why the two ledgers must never be summed together.
//
// Categories themselves are USER-DEFINED at runtime and live in the
// living_category table — the lists below are a starting template, not a
// closed enum. Anything here can be renamed or archived by the scholar, and
// she can add categories that appear nowhere in this file.

// What the app reasons about, regardless of what she names a category.
export const LIVING_KINDS = [
  { key: 'fixed',    label: 'Fixed',    hint: 'Same amount every month — rent, wifi' },
  { key: 'variable', label: 'Variable', hint: 'Changes month to month — food, fuel' },
  { key: 'sinking',  label: 'Sinking',  hint: "Not billed monthly — save a little each month for it" },
];

// Stable grouping so scholars' self-named categories stay comparable to each
// other in the mentor view (April and Nathalie will invent different names).
export const LIVING_ROLLUPS = [
  { key: 'housing',   label: 'Housing'   },
  { key: 'food',      label: 'Food'      },
  { key: 'transport', label: 'Transport' },
  { key: 'school',    label: 'School'    },
  { key: 'personal',  label: 'Personal'  },
  { key: 'savings',   label: 'Savings'   },
];

// Auto-created the first time a scholar opens their budget. A blank page is
// both paralysing and counterproductive — it guarantees the easy-to-forget
// categories stay forgotten. Every one of these can be renamed or archived.
export const LIVING_SEED_CATEGORIES = [
  { name: 'Dorm Rent',               kind: 'fixed',    rollup: 'housing'   },
  { name: 'Food',                    kind: 'variable', rollup: 'food'      },
  { name: 'Fuel',                    kind: 'variable', rollup: 'transport' },
  { name: 'Parking',                 kind: 'fixed',    rollup: 'transport' },
  { name: 'Load & Data',             kind: 'fixed',    rollup: 'personal'  },
  { name: 'Laundry',                 kind: 'variable', rollup: 'personal'  },
  { name: 'Toiletries',              kind: 'variable', rollup: 'personal'  },
  { name: 'Printing & Photocopying', kind: 'variable', rollup: 'school'    },
  { name: 'Savings',                 kind: 'variable', rollup: 'savings'   },
];

// Offered as one-tap additions, NOT auto-created. These are the costs that
// ambush a first budget: they are real, they are irregular, and nobody
// remembers them in month one. The motorcycle ones especially — registration
// and insurance arrive annually and land as a crisis if never accrued for.
export const LIVING_PROMPTS = [
  { name: 'Motorcycle Maintenance', kind: 'sinking',  rollup: 'transport', sinkingMonths: 3,
    hint: 'Oil, tires, brakes, chain' },
  { name: 'LTO Registration',       kind: 'sinking',  rollup: 'transport', sinkingMonths: 12,
    hint: 'Once a year' },
  { name: 'TPL Insurance',          kind: 'sinking',  rollup: 'transport', sinkingMonths: 12,
    hint: 'Once a year' },
  { name: 'Rain Gear',              kind: 'sinking',  rollup: 'transport', sinkingMonths: 6,
    hint: 'Rainy season does not pause clinicals' },
  { name: 'Clinical Duty Fees',     kind: 'variable', rollup: 'school',
    hint: 'Varies by rotation' },
  { name: 'Uniform & Scrubs',       kind: 'sinking',  rollup: 'school',    sinkingMonths: 6,
    hint: 'Replacement, not the first set' },
  { name: 'Nursing Kit',            kind: 'sinking',  rollup: 'school',    sinkingMonths: 6,
    hint: 'Steth, BP cuff, penlight' },
  { name: 'Medicine & Health',      kind: 'variable', rollup: 'personal'   },
  { name: 'Emergency Buffer',       kind: 'variable', rollup: 'savings',
    hint: 'For the month something goes wrong' },
];

// Monthly accrual for a sinking category: total cost spread over the months
// until it is due. Returns 0 unless both halves are set.
export function sinkingMonthly(cat) {
  const target = Number(cat?.sinking_target_php);
  const months = Number(cat?.sinking_months);
  if (!target || !months || months <= 0) return 0;
  return target / months;
}
