// Tier 1 query resolver — pattern-match question types to SQL, return answers
// without an LLM call. Returns { answered: false } to escalate to Tier 2.
//
// Future-proofing note: expense categories are fetched live from the DB rather
// than hardcoded, so new categories added to the expenses table are auto-detected
// without any code changes here.

import { sql } from '../db.js'

// Tier1Result shape (JSDoc-only, no runtime effect):
// { answered: boolean, intent?: string, answer?: string, data?: unknown }

function phpStr(amount) {
  const abs = Math.abs(amount)
  const formatted = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (amount < 0 ? '-₱' : '₱') + formatted
}

// Pull distinct expense categories from the DB for this scholar.
// Falls back to an empty list on error — classify() degrades gracefully.
async function fetchCategories(scholar) {
  const data = await sql`select cat from expenses where scholar = ${scholar} and cat is not null`
  if (!data) return []
  const seen = new Set()
  for (const r of data) if (r.cat) seen.add(r.cat)
  return [...seen]
}

// ── Intent classification ──────────────────────────────────────────────────────

// Intent values:
// 'expense_by_category' | 'expense_total' | 'budget_status' | 'gpa_trend' |
// 'milestone_status' | 'travel_status' | 'deadlines' | 'alerts' |
// 'oet_readiness' | 'english_hours' | 'open_actions' | 'progress_summary' |
// 'recent_expenses' | 'unknown'

// Classified shape: { type: Intent, category?: string, state?: 'pending'|'complete'|'all', travelState?: 'pending'|'complete'|'all' }

function classify(text, liveCategories) {
  const q = text.toLowerCase()

  // Advisory / comparative questions — escalate to Tier 2 before any data pattern fires.
  // These contain data-adjacent words ("spending", "score", "grade") but the question is
  // asking for judgment, comparison, or external knowledge rather than a DB lookup.
  if (/\bnormal\b|\btypical\b|\baverage\b|\bbenchmark\b|\bcompare\b|\brecommend\b|\badvice\b|\badvise\b|\bshould\b|\bwhen.*should\b|\bwhat.*require[sd]?\b|\bwhat.*need[sd]?\b|\bstrateg/.test(q)) {
    return { type: 'unknown' }
  }

  // Category match uses live DB categories — auto-adapts as new categories are added
  const matchedCat = liveCategories.find(c => q.includes(c.toLowerCase()))
  if (matchedCat) return { type: 'expense_by_category', category: matchedCat }

  if (/recent.*expense|latest.*expense|spent.*recently|last.*purchase|what.*buy|what.*bought|what.*purchase|show.*expense|list.*expense/.test(q)) {
    return { type: 'recent_expenses' }
  }

  if (/how much.*spent|total.*spend|spend.*total|spending|all.*expense|expense.*total|\bexpenses\b/.test(q)) {
    return { type: 'expense_total' }
  }

  if (/budget|over.budget|remaining|budget.left|how much.left|money.*left|left.*budget/.test(q)) {
    return { type: 'budget_status' }
  }

  if (/\bgpa\b|grade.*point|academic.*record|mark|how.*grade|grade.*average/.test(q)) {
    return { type: 'gpa_trend' }
  }

  if (/milestone|checkpoint/.test(q)) {
    const state =
      /pending|incomplete|not.done|still|outstanding/.test(q) ? 'pending' :
      /complete|done|finished|achieved/.test(q)               ? 'complete' : 'all'
    return { type: 'milestone_status', state }
  }

  if (/\btravel|trip|flight|accommodation|abroad|visa|destination/.test(q)) {
    const travelState =
      /pending|planned|upcoming|not.yet/.test(q) ? 'pending' :
      /complete|done|finished|already/.test(q)   ? 'complete' : 'all'
    return { type: 'travel_status', travelState }
  }

  if (/\bdue\b|deadline|upcoming|what.*schedule|what.*calendar|what.*next/.test(q)) {
    return { type: 'deadlines' }
  }

  if (/\balert|issue|problem|warning|urgent|critical/.test(q)) {
    return { type: 'alerts' }
  }

  if (/oet.*readiness|readiness.*oet|oet.*ready|ready.*oet|oet.*assess|oet.*on.?track|oet.*progress\b/.test(q)) {
    return { type: 'oet_readiness' }
  }

  if (/\boet\b|english.*hour|ielts|study.*hour|session|how.*study|study.*time/.test(q)) {
    return { type: 'english_hours' }
  }

  if (/action item|to.?do|open item|pending task|what.*need.*done|what.*should.*do|tasks?/.test(q)) {
    return { type: 'open_actions' }
  }

  if (/progress|where.*program|current.*stage|program.*track|how.*doing|overview|summary/.test(q)) {
    return { type: 'progress_summary' }
  }

  // status alone is ambiguous — only trigger progress_summary if no other intent matched
  if (/\bstatus\b/.test(q)) {
    return { type: 'progress_summary' }
  }

  return { type: 'unknown' }
}

// ── Resolvers ─────────────────────────────────────────────────────────────────

async function expenseTotal(scholar, category) {
  const conditions = [`scholar = $1`, `avb <> 'Budget'`]
  const values = [scholar]
  if (category) {
    values.push(category)
    conditions.push(`cat = $${values.length}`)
  }
  const rows = await sql.query(
    `select amount,qty,cat,sem from expenses where ${conditions.join(' and ')}`,
    values
  )
  const catStr = category ? ` on ${category}` : ''

  if (rows.length === 0) {
    return {
      answered: true,
      intent: category ? 'expense_by_category' : 'expense_total',
      answer: `No expenses${catStr} have been recorded yet.`,
      data: { total: 0, count: 0 },
    }
  }

  const total = rows.reduce((s, r) => s + (r.amount ?? 0) * (r.qty ?? 1), 0)
  const bySem = {}
  for (const r of rows) bySem[r.sem] = (bySem[r.sem] ?? 0) + (r.amount ?? 0) * (r.qty ?? 1)
  const semCount = Object.keys(bySem).length
  const semLines = Object.entries(bySem).map(([sem, amt]) => `  ${sem}: ${phpStr(amt)}`).join('\n')

  return {
    answered: true,
    intent: category ? 'expense_by_category' : 'expense_total',
    answer: `Total spent${catStr}: ${phpStr(total)} across ${semCount} semester${semCount !== 1 ? 's' : ''}.\n\nBy semester:\n${semLines}`,
    data: { total, bySem, count: rows.length },
  }
}

async function budgetStatus(scholar) {
  const [budgets, expenses] = await Promise.all([
    sql`select sem,amount_php from budgets where scholar = ${scholar}`,
    sql`select amount,qty,sem from expenses where scholar = ${scholar} and avb <> 'Budget'`,
  ])

  const expBySem = {}
  for (const e of expenses ?? []) expBySem[e.sem] = (expBySem[e.sem] ?? 0) + (e.amount ?? 0) * (e.qty ?? 1)

  if ((budgets ?? []).length === 0) {
    return { answered: true, intent: 'budget_status', answer: 'No budget data found.', data: {} }
  }

  const lines = (budgets ?? []).map(b => {
    const spent     = expBySem[b.sem] ?? 0
    const budget    = b.amount_php ?? 0
    const remaining = budget - spent
    const pct       = budget > 0 ? Math.round((spent / budget) * 100) : 0
    const status    = remaining < 0            ? 'OVER BUDGET'
                    : remaining < budget * 0.1 ? 'Near limit'
                    : 'OK'
    return `  ${b.sem}: ${phpStr(spent)} spent of ${phpStr(budget)} (${pct}%) — ${status}`
  })

  return {
    answered: true,
    intent: 'budget_status',
    answer: `Budget status by semester:\n${lines.join('\n')}`,
    data: { budgets, expBySem },
  }
}

async function gpaHistory(scholar) {
  const rows = await sql`select sem,gpa,status,note from academics where scholar = ${scholar} order by sem`

  if (rows.length === 0) return { answered: true, intent: 'gpa_trend', answer: 'No academic records found.', data: [] }

  const lines = rows.map(r => `  ${r.sem}: GPA ${r.gpa} — ${r.status}${r.note ? ' (' + r.note + ')' : ''}`)
  const latest = rows[rows.length - 1]

  return {
    answered: true,
    intent: 'gpa_trend',
    answer: `Academic history (${rows.length} semester${rows.length !== 1 ? 's' : ''}):\n${lines.join('\n')}\n\nMost recent: ${latest.sem} — GPA ${latest.gpa} (${latest.status})`,
    data: rows,
  }
}

async function milestoneStatus(scholar, state) {
  const conditions = [`scholar = $1`]
  const values = [scholar]
  if (state === 'pending')  { conditions.push(`state = 'pending'`) }
  if (state === 'complete') { conditions.push(`state = 'complete'`) }
  const rows = await sql.query(
    `select name,state,sem,amount_php from milestones where ${conditions.join(' and ')}`,
    values
  )

  const stateStr = state && state !== 'all' ? ` ${state}` : ''
  if (rows.length === 0) return { answered: true, intent: 'milestone_status', answer: `No${stateStr} milestones found.`, data: [] }

  const lines = rows.map(r =>
    `  [${r.state}] ${r.name} (${r.sem})${r.amount_php ? ' — ' + phpStr(r.amount_php) : ''}`
  )

  return {
    answered: true,
    intent: 'milestone_status',
    answer: `${rows.length}${stateStr} milestone${rows.length !== 1 ? 's' : ''}:\n${lines.join('\n')}`,
    data: rows,
  }
}

async function upcomingDeadlines(scholar) {
  const rows = await sql`select event,when_date,cat,urgency from deadlines where scholar = ${scholar} order by sort_date limit 10`

  if (rows.length === 0) return { answered: true, intent: 'deadlines', answer: 'No upcoming deadlines.', data: [] }

  const lines = rows.map(r => `  [${r.urgency ?? 'normal'}] ${r.event} — ${r.when_date} (${r.cat ?? 'general'})`)

  return {
    answered: true,
    intent: 'deadlines',
    answer: `Upcoming deadlines (${rows.length}):\n${lines.join('\n')}`,
    data: rows,
  }
}

async function activeAlerts(scholar) {
  const rows = await sql`select severity,title,sub from alerts where scholar = ${scholar}`

  if (rows.length === 0) return { answered: true, intent: 'alerts', answer: 'No active alerts.', data: [] }

  const lines = rows.map(r => `  [${r.severity}] ${r.title}${r.sub ? ': ' + r.sub : ''}`)

  return {
    answered: true,
    intent: 'alerts',
    answer: `Active alerts (${rows.length}):\n${lines.join('\n')}`,
    data: rows,
  }
}

async function englishHours(scholar) {
  const rows = await sql`select sem,duration_minutes,activity_type from english_sessions where scholar = ${scholar}`

  if (rows.length === 0) {
    return { answered: true, intent: 'english_hours', answer: 'No English/OET sessions logged yet.', data: { totalHours: 0, sessions: 0 } }
  }

  const totalMin = rows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0)
  const totalHours = (totalMin / 60).toFixed(1)

  const bySem = {}
  for (const r of rows) bySem[r.sem] = (bySem[r.sem] ?? 0) + r.duration_minutes
  const semLines = Object.entries(bySem).map(([sem, min]) => `  ${sem}: ${(min / 60).toFixed(1)} hrs`).join('\n')

  return {
    answered: true,
    intent: 'english_hours',
    answer: `Total English/OET hours: ${totalHours} hrs across ${rows.length} session${rows.length !== 1 ? 's' : ''}.\n\nBy semester:\n${semLines}`,
    data: { totalHours, bySem, sessions: rows.length },
  }
}

async function openActions(scholar) {
  const rows = await sql`select text,cat from actions where scholar = ${scholar} and done = false`

  if (rows.length === 0) return { answered: true, intent: 'open_actions', answer: 'No open action items.', data: [] }

  const lines = rows.map(r => `  • [${r.cat ?? 'general'}] ${r.text}`)

  return {
    answered: true,
    intent: 'open_actions',
    answer: `Open action items (${rows.length}):\n${lines.join('\n')}`,
    data: rows,
  }
}

async function progressSummary(scholar) {
  const [profileRows, academics, milestones] = await Promise.all([
    sql`select name,track,program,status,current_sem,gpa_floor,card_stage,card_year from scholars where scholar_key = ${scholar}`,
    sql`select sem,gpa,status from academics where scholar = ${scholar} order by sem`,
    sql`select state from milestones where scholar = ${scholar}`,
  ])
  const profile = profileRows[0]
  if (!profile) return { answered: true, intent: 'progress_summary', answer: `Scholar "${scholar}" not found.`, data: null }

  const rows   = academics ?? []
  const latest = rows.length > 0 ? rows[rows.length - 1] : null
  const mRows  = milestones ?? []
  const done   = mRows.filter(m => m.state === 'complete').length

  const lines = [
    `${profile.name} — ${profile.track}`,
    `Program: ${profile.program} (${profile.status})`,
    `Current semester: ${profile.current_sem}`,
    profile.card_stage ? `Stage: ${profile.card_stage}${profile.card_year ? ' (' + profile.card_year + ')' : ''}` : null,
    latest ? `Latest GPA: ${latest.gpa} in ${latest.sem} (${latest.status})` : 'No GPA on record',
    `Milestones: ${done} of ${mRows.length} complete`,
    `GPA floor: ${profile.gpa_floor}`,
  ].filter(Boolean)

  return {
    answered: true,
    intent: 'progress_summary',
    answer: lines.join('\n'),
    data: { profile, latestAcademic: latest, milestoneCount: mRows.length, completedMilestones: done },
  }
}

async function travelStatus(scholar, state) {
  const conditions = [`scholar = $1`]
  const values = [scholar]
  if (state === 'pending')  { conditions.push(`state = 'pending'`) }
  if (state === 'complete') { conditions.push(`state = 'complete'`) }
  const rows = await sql.query(
    `select dest,sem,state,amount_php from travels where ${conditions.join(' and ')}`,
    values
  )

  const stateStr = state && state !== 'all' ? ` ${state}` : ''
  if (rows.length === 0) return { answered: true, intent: 'travel_status', answer: `No${stateStr} travel records found.`, data: [] }

  const lines = rows.map(r =>
    `  [${r.state}] ${r.dest} (${r.sem})${r.amount_php ? ' — ' + phpStr(r.amount_php) : ''}`
  )

  return {
    answered: true,
    intent: 'travel_status',
    answer: `${rows.length}${stateStr} travel record${rows.length !== 1 ? 's' : ''}:\n${lines.join('\n')}`,
    data: rows,
  }
}

async function recentExpenses(scholar) {
  const rows = await sql`select item,amount,qty,cat,date,vendor from expenses where scholar = ${scholar} order by date desc limit 10`

  if (rows.length === 0) return { answered: true, intent: 'recent_expenses', answer: 'No expenses recorded.', data: [] }

  const lines = rows.map(r => {
    const total  = (r.amount ?? 0) * (r.qty ?? 1)
    const vendor = r.vendor ? ` @ ${r.vendor}` : ''
    return `  ${r.date} — ${r.item}${vendor}: ${phpStr(total)} (${r.cat})`
  })

  return {
    answered: true,
    intent: 'recent_expenses',
    answer: `Last ${rows.length} expense${rows.length !== 1 ? 's' : ''}:\n${lines.join('\n')}`,
    data: rows,
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function tier1Resolve(text, scholar) {
  // Fetch live categories so classification adapts to new ones without code changes
  const liveCategories = await fetchCategories(scholar)
  const { type, category, state, travelState } = classify(text, liveCategories)

  switch (type) {
    case 'expense_by_category': return expenseTotal(scholar, category)
    case 'expense_total':       return expenseTotal(scholar)
    case 'budget_status':       return budgetStatus(scholar)
    case 'gpa_trend':           return gpaHistory(scholar)
    case 'milestone_status':    return milestoneStatus(scholar, state)
    case 'travel_status':       return travelStatus(scholar, travelState)
    case 'deadlines':           return upcomingDeadlines(scholar)
    case 'alerts':              return activeAlerts(scholar)
    case 'oet_readiness':       return { answered: false }   // always escalates to Tier 2 for narrative
    case 'english_hours':       return englishHours(scholar)
    case 'open_actions':        return openActions(scholar)
    case 'progress_summary':    return progressSummary(scholar)
    case 'recent_expenses':     return recentExpenses(scholar)
    default:                    return { answered: false }
  }
}
