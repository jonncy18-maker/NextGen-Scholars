// Scholar context builder — assembles a compact JSON context block suitable for
// injecting into any LLM prompt (Tier 2 advisory, Tier 3 ingestion).
//
// ── Adding new data to the system ────────────────────────────────────────────
// When a new table is added:
//   1. Add one entry to SCHEMA_REGISTRY below (table name, key columns, note).
//   2. Add one query in buildContext() to fetch and shape the data.
//   3. Add the shaped data to the returned ScholarContext object.
//
// That's it. Gemini (Tier 2) receives the schema registry in every prompt, so
// it can reason about any new table without further code changes to the LLM layer.
// ─────────────────────────────────────────────────────────────────────────────

import { sql } from '../db.js'

// Registry of all data tables. Single source of truth for what exists in the DB.
// Gemini receives this in every Tier 2 prompt so it knows the full data model.
// ADD NEW TABLES HERE.
export const SCHEMA_REGISTRY = [
  {
    table: 'scholars',
    cols:  ['scholar_key', 'name', 'first_name', 'track', 'school', 'city', 'program', 'cohort', 'status', 'current_sem', 'gpa_floor', 'card_stage', 'card_year', 'card_progress'],
    note:  'One row per scholar. Core profile and program metadata.',
  },
  {
    table: 'academics',
    cols:  ['scholar', 'sem', 'gpa', 'status', 'note'],
    note:  'GPA history — one row per semester per scholar.',
  },
  {
    table: 'milestones',
    cols:  ['scholar', 'name', 'state', 'sem', 'amount_php'],
    note:  'Program milestones (state: pending | complete). amount_php is the associated cost.',
  },
  {
    table: 'travels',
    cols:  ['scholar', 'dest', 'sem', 'state', 'amount_php'],
    note:  'Travel and accommodation records.',
  },
  {
    table: 'budgets',
    cols:  ['scholar', 'sem', 'amount_php'],
    note:  'Per-semester budget allocations in PHP.',
  },
  {
    table: 'expenses',
    cols:  ['scholar', 'sem', 'item', 'amount', 'qty', 'cat', 'date', 'vendor'],
    note:  'All expense line items. Total = amount × qty. cat is the expense category.',
  },
  {
    table: 'alerts',
    cols:  ['scholar', 'severity', 'title', 'sub'],
    note:  'Active mentor alerts. severity: critical | warning | info.',
  },
  {
    table: 'deadlines',
    cols:  ['scholar', 'event', 'when_date', 'sort_date', 'cat', 'urgency'],
    note:  'Upcoming deadlines ordered by sort_date.',
  },
  {
    table: 'actions',
    cols:  ['scholar', 'text', 'cat', 'done'],
    note:  'Action items. done=false means open/outstanding.',
  },
  {
    table: 'english_sessions',
    cols:  ['scholar', 'sem', 'date', 'duration_minutes', 'activity_type', 'notes'],
    note:  'OET/English study session log. duration_minutes sums to total study hours.',
  },
  {
    table: 'expense_submissions',
    cols:  ['scholar_key', 'expense_data', 'status', 'rejection_comment', 'reviewed_at', 'created_at'],
    note:  'Scholar-submitted expense proposals awaiting mentor review (status: pending | approved | rejected).',
  },
  {
    table: 'activity_log',
    cols:  ['scholar_key', 'type', 'expense_id', 'expense_data', 'changes', 'read', 'created_at'],
    note:  'Audit log of scholar-initiated expense changes (added | edited | delete_request).',
  },
  {
    table: 'config',
    cols:  ['key', 'value'],
    note:  'Global config pairs. Keys include exchangeRate and lastUpdated.',
  },
]

// ScholarContext shape (JSDoc-only, no runtime effect):
// {
//   scholar: string,
//   asOf: string,
//   profile: object | null,
//   academics: { sem, gpa, status, note }[],
//   expenses: { total, bySem, categories, recent10: { date, item, vendor, amount, cat }[] },
//   budget: { bySem },
//   milestones: { name, state, sem, amountPhp }[],
//   travels: { dest, sem, state, amountPhp }[],
//   alerts: { severity, title, sub }[],
//   deadlines: { event, when, cat, urgency }[],
//   openActions: { text, cat }[],
//   english: { totalMinutes, totalHours, sessions, bySem, byCategory, paceMinsLast4Weeks },
//   pendingSubmissions: number,
//   schema: typeof SCHEMA_REGISTRY,
// }

export async function buildContext(scholar) {
  const [
    profileRows,
    academics,
    milestones,
    travels,
    budgets,
    expenses,
    alerts,
    deadlines,
    actions,
    englishRaw,
    submissions,
  ] = await Promise.all([
    sql`select * from scholars where scholar_key = ${scholar}`,
    sql`select sem,gpa,status,note from academics where scholar = ${scholar} order by sem`,
    sql`select name,state,sem,amount_php from milestones where scholar = ${scholar}`,
    sql`select dest,sem,state,amount_php from travels where scholar = ${scholar}`,
    sql`select sem,amount_php from budgets where scholar = ${scholar}`,
    sql`select item,amount,qty,cat,date,vendor,sem from expenses where scholar = ${scholar} order by date desc`,
    sql`select severity,title,sub from alerts where scholar = ${scholar}`,
    sql`select event,when_date,cat,urgency from deadlines where scholar = ${scholar} order by sort_date limit 15`,
    sql`select text,cat from actions where scholar = ${scholar} and done = false`,
    sql`select sem,duration_minutes,activity_type,date from english_sessions where scholar = ${scholar}`,
    sql`select id from expense_submissions where scholar_key = ${scholar} and status = 'pending'`,
  ])

  const profile = profileRows[0] ?? null

  // Expense aggregations
  const expRows = expenses ?? []
  let expTotal = 0
  const expBySem = {}
  const catSet = new Set()
  for (const e of expRows) {
    const line = (e.amount ?? 0) * (e.qty ?? 1)
    expTotal += line
    expBySem[e.sem] = (expBySem[e.sem] ?? 0) + line
    if (e.cat) catSet.add(e.cat)
  }

  // Budget by sem
  const budgetBySem = {}
  for (const b of budgets ?? []) budgetBySem[b.sem] = b.amount_php ?? 0

  // English sessions
  const engRows     = englishRaw ?? []
  const totalMinutes = engRows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0)
  const engBySem     = {}
  const engByCat     = {}
  const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
  let paceMinsLast4Weeks = 0
  for (const r of engRows) {
    const mins = r.duration_minutes ?? 0
    engBySem[r.sem] = (engBySem[r.sem] ?? 0) + mins
    if (r.activity_type) engByCat[r.activity_type] = (engByCat[r.activity_type] ?? 0) + mins
    if (r.date && new Date(r.date) >= cutoff) paceMinsLast4Weeks += mins
  }

  return {
    scholar,
    asOf:    new Date().toISOString(),
    profile: profile ?? null,
    academics: (academics ?? []).map(r => ({
      sem: r.sem, gpa: r.gpa, status: r.status, note: r.note ?? null,
    })),
    expenses: {
      total:      expTotal,
      bySem:      expBySem,
      categories: [...catSet],
      recent10:   expRows.slice(0, 10).map(e => ({
        date: e.date, item: e.item, vendor: e.vendor ?? '', amount: (e.amount ?? 0) * (e.qty ?? 1), cat: e.cat,
      })),
    },
    budget: { bySem: budgetBySem },
    milestones: (milestones ?? []).map(r => ({
      name: r.name, state: r.state, sem: r.sem, amountPhp: r.amount_php ?? 0,
    })),
    travels: (travels ?? []).map(r => ({
      dest: r.dest, sem: r.sem, state: r.state, amountPhp: r.amount_php ?? 0,
    })),
    alerts: (alerts ?? []).map(a => ({ severity: a.severity, title: a.title, sub: a.sub ?? null })),
    deadlines: (deadlines ?? []).map(d => ({
      event: d.event, when: d.when_date, cat: d.cat ?? null, urgency: d.urgency ?? null,
    })),
    openActions: (actions ?? []).map(a => ({ text: a.text, cat: a.cat ?? null })),
    english: {
      totalMinutes,
      totalHours:         (totalMinutes / 60).toFixed(1),
      sessions:           engRows.length,
      bySem:              engBySem,
      byCategory:         engByCat,
      paceMinsLast4Weeks,
    },
    pendingSubmissions: (submissions ?? []).length,
    schema: SCHEMA_REGISTRY,
  }
}
