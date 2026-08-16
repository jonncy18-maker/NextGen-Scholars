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
//
// `key` is the value stored in living_category.kind and is FIXED by the DB
// check constraint ('fixed' | 'variable' | 'sinking'). `label` is what a human
// sees. The two deliberately differ: "Variable"/"Sinking" are budgeting jargon
// that meant nothing to the scholars using this, so the UI says Flexible and
// Non-recurring instead. Never rename the keys to match the labels — that is a
// migration, not a rename.
export const LIVING_KINDS = [
  { key: 'fixed',    label: 'Fixed',         hint: 'Same amount every month — rent, parking' },
  { key: 'variable', label: 'Flexible',      hint: 'Changes month to month — food, fuel' },
  { key: 'sinking',  label: 'Non-recurring', hint: 'Lands later — fare home, gifts, haircut' },
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
// ambush a first budget: real, irregular, and forgotten in month one.
//
// ── Everything here must be HER money ──────────────────────────────────────
// This list used to carry LTO Registration, TPL Insurance, Uniform & Scrubs,
// Nursing Kit, Rain Gear and Motorcycle Maintenance. Every one of those is
// PROGRAM-funded — they map onto EXPENSE_CATS ('Motor', 'Uniforms', 'Medical
// Equipment') and are paid from the scholarship, not from her allowance.
// Planning them here made her budget for money she never receives and set up
// exactly the double-count db/living_budget.sql exists to prevent.
//
// The genuinely personal lumpy costs cluster around family, home and social
// obligation — which is what a first-time budgeter actually gets ambushed by.
// Before adding anything here, ask: does the scholarship pay for this? If yes,
// it belongs in the mentor's expense tracker, not in her budget.
export const LIVING_PROMPTS = [
  { name: 'Fare Home',         kind: 'sinking',  rollup: 'transport', sinkingMonths: 4,
    hint: 'Sem break, fiesta, Christmas' },
  { name: 'Gifts',             kind: 'sinking',  rollup: 'personal',  sinkingMonths: 12,
    hint: 'Christmas and birthdays land in one brutal month' },
  { name: 'Fiesta',            kind: 'sinking',  rollup: 'personal',  sinkingMonths: 12,
    hint: 'Town celebration contribution' },
  { name: 'Haircut',           kind: 'sinking',  rollup: 'personal',  sinkingMonths: 3 },
  { name: 'Shoes & Slippers',  kind: 'sinking',  rollup: 'personal',  sinkingMonths: 6,
    hint: 'Everyday footwear — the program buys clinical shoes' },
  { name: 'Everyday Clothes',  kind: 'sinking',  rollup: 'personal',  sinkingMonths: 6,
    hint: 'Not uniforms — those are covered' },
  { name: 'Dorm Deposit',      kind: 'sinking',  rollup: 'housing',   sinkingMonths: 6,
    hint: 'If your landlord asks for advance months' },
  { name: 'Medicine & Health', kind: 'variable', rollup: 'personal'   },
  { name: 'Emergency Buffer',  kind: 'variable', rollup: 'savings',
    hint: 'For the month something goes wrong' },
];

// ── Normalising a rhythm to a month ────────────────────────────────────────
// An AVERAGE month, deliberately — not the calendar length of the month being
// edited. A category built from daily items then reads the same figure every
// month instead of drifting between a 28-day February and a 31-day August.
// A budget is a plan, not a forecast: a number that moves for reasons she did
// not cause reads as a bug and ruins month-to-month comparison. Because these
// are the true averages, the ANNUAL total still comes out exactly right.
export const MONTH_DAYS  = 365.25 / 12;        // 30.4375
export const MONTH_WEEKS = MONTH_DAYS / 7;     //  4.3482

export const LIVING_BASES = [
  { key: 'day',   label: 'day',   per: MONTH_DAYS  },
  { key: 'week',  label: 'week',  per: MONTH_WEEKS },
  { key: 'month', label: 'month', per: 1           },
];

const BASIS_PER = Object.fromEntries(LIVING_BASES.map(b => [b.key, b.per]));

// One line item's contribution to the month, rounded to the peso.
//
// Rounding happens PER LINE and the rounded lines are then summed (see
// itemsTotalPhp). Rounding once at the end would be marginally more accurate
// but would leave the figures on screen not adding up to the total on screen —
// which reads as a broken app to the person relying on it.
export function itemMonthlyPhp(item) {
  const qty  = Number(item?.qty);
  const unit = Number(item?.unit_php ?? item?.unitPhp);
  const per  = BASIS_PER[item?.basis] ?? 1;
  if (!Number.isFinite(qty) || !Number.isFinite(unit)) return 0;
  return Math.round(qty * unit * per);
}

export function itemsTotalPhp(items) {
  return (items || []).reduce((sum, it) => sum + itemMonthlyPhp(it), 0);
}

// Monthly accrual for a sinking category: total cost spread over the months
// until it is due. Returns 0 unless both halves are set.
export function sinkingMonthly(cat) {
  const target = Number(cat?.sinking_target_php);
  const months = Number(cat?.sinking_months);
  if (!target || !months || months <= 0) return 0;
  return target / months;
}
