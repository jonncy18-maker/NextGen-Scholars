// Scholar context builder — assembles a compact JSON context block suitable for
// injecting into any LLM prompt (Tier 2 advisory, Tier 3 ingestion).
//
// ── Adding new data to the system ────────────────────────────────────────────
// When a new Supabase table is added:
//   1. Add one entry to SCHEMA_REGISTRY below (table name, key columns, note).
//   2. Add one query in buildContext() to fetch and shape the data.
//   3. Add the shaped data to the returned ScholarContext object.
//
// That's it. Gemini (Tier 2) receives the schema registry in every prompt, so
// it can reason about any new table without further code changes to the LLM layer.
// ─────────────────────────────────────────────────────────────────────────────

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
] as const

export interface ScholarContext {
  scholar:     string
  asOf:        string
  profile:     Record<string, unknown> | null
  academics:   { sem: string; gpa: number; status: string; note: string | null }[]
  expenses: {
    total:      number
    bySem:      Record<string, number>
    categories: string[]
    recent10:   { date: string; item: string; vendor: string; amount: number; cat: string }[]
  }
  budget:      { bySem: Record<string, number> }
  milestones:  { name: string; state: string; sem: string; amountPhp: number }[]
  travels:     { dest: string; sem: string; state: string; amountPhp: number }[]
  alerts:      { severity: string; title: string; sub: string | null }[]
  deadlines:   { event: string; when: string; cat: string | null; urgency: string | null }[]
  openActions: { text: string; cat: string | null }[]
  english: {
    totalMinutes: number
    totalHours:   string
    sessions:     number
    bySem:        Record<string, number>
  }
  pendingSubmissions: number
  schema: typeof SCHEMA_REGISTRY
}

export async function buildContext(scholar: string, sb: SupabaseClient): Promise<ScholarContext> {
  const [
    { data: profile },
    { data: academics },
    { data: milestones },
    { data: travels },
    { data: budgets },
    { data: expenses },
    { data: alerts },
    { data: deadlines },
    { data: actions },
    { data: englishRaw },
    { data: submissions },
  ] = await Promise.all([
    sb.from('scholars').select('*').eq('scholar_key', scholar).single(),
    sb.from('academics').select('sem,gpa,status,note').eq('scholar', scholar).order('sem'),
    sb.from('milestones').select('name,state,sem,amount_php').eq('scholar', scholar),
    sb.from('travels').select('dest,sem,state,amount_php').eq('scholar', scholar),
    sb.from('budgets').select('sem,amount_php').eq('scholar', scholar),
    sb.from('expenses').select('item,amount,qty,cat,date,vendor,sem').eq('scholar', scholar).order('date', { ascending: false }),
    sb.from('alerts').select('severity,title,sub').eq('scholar', scholar),
    sb.from('deadlines').select('event,when_date,cat,urgency').eq('scholar', scholar).order('sort_date').limit(15),
    sb.from('actions').select('text,cat').eq('scholar', scholar).eq('done', false),
    sb.from('english_sessions').select('sem,duration_minutes').eq('scholar', scholar),
    sb.from('expense_submissions').select('id').eq('scholar_key', scholar).eq('status', 'pending'),
  ])

  // Expense aggregations
  const expRows = expenses ?? []
  let expTotal = 0
  const expBySem: Record<string, number> = {}
  const catSet = new Set<string>()
  for (const e of expRows) {
    const line = (e.amount ?? 0) * (e.qty ?? 1)
    expTotal += line
    expBySem[e.sem] = (expBySem[e.sem] ?? 0) + line
    if (e.cat) catSet.add(e.cat as string)
  }

  // Budget by sem
  const budgetBySem: Record<string, number> = {}
  for (const b of budgets ?? []) budgetBySem[b.sem] = b.amount_php ?? 0

  // English sessions
  const engRows = englishRaw ?? []
  const totalMinutes = engRows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0)
  const engBySem: Record<string, number> = {}
  for (const r of engRows) engBySem[r.sem] = (engBySem[r.sem] ?? 0) + (r.duration_minutes ?? 0)

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
      totalHours:  (totalMinutes / 60).toFixed(1),
      sessions:    engRows.length,
      bySem:       engBySem,
    },
    pendingSubmissions: (submissions ?? []).length,
    schema: SCHEMA_REGISTRY,
  }
}
