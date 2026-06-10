import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function num(v: unknown): number {
  const n = parseFloat(v as string)
  return isNaN(n) ? 0 : n
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const url = new URL(req.url)
  const key = url.searchParams.get('key')
  if (!key) return json({ error: 'Missing required param: key' }, 400)

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verify caller is an authenticated user (mentor session)
  const { data: { user }, error: authErr } = await sb.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  const [
    { data: scholar,     error: e1 },
    { data: academics,   error: e2 },
    { data: milestones,  error: e3 },
    { data: travels,     error: e4 },
    { data: budgets,     error: e5 },
    { data: expenses,    error: e6 },
    { data: alerts,      error: e7 },
    { data: deadlines,   error: e8 },
    { data: actions,     error: e9 },
    { data: submissions, error: e10 },
  ] = await Promise.all([
    sb.from('scholars').select('*').eq('scholar_key', key).single(),
    sb.from('academics').select('*').eq('scholar', key).order('sem'),
    sb.from('milestones').select('*').eq('scholar', key),
    sb.from('travels').select('*').eq('scholar', key),
    sb.from('budgets').select('*').eq('scholar', key),
    sb.from('expenses').select('*').eq('scholar', key).order('date', { ascending: false }),
    sb.from('alerts').select('*').eq('scholar', key),
    sb.from('deadlines').select('*').eq('scholar', key).order('sort_date'),
    sb.from('actions').select('*').eq('scholar', key).eq('done', false),
    sb.from('expense_submissions').select('id, status, created_at')
      .eq('scholar_key', key).eq('status', 'pending'),
  ])

  const firstError = e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8 || e9 || e10
  if (firstError) return json({ error: firstError.message }, 500)
  if (!scholar) return json({ error: `Scholar not found: ${key}` }, 404)

  // Aggregate expense totals by semester
  const expensesBySem: Record<string, { totalPhp: number; items: number }> = {}
  for (const e of expenses ?? []) {
    const amt = num(e.amount) * (num(e.qty) || 1)
    if (!expensesBySem[e.sem]) expensesBySem[e.sem] = { totalPhp: 0, items: 0 }
    expensesBySem[e.sem].totalPhp += amt
    expensesBySem[e.sem].items++
  }

  const budgetBySem: Record<string, number> = {}
  for (const b of budgets ?? []) budgetBySem[b.sem] = num(b.amount_php)

  return json({
    scholar: key,
    asOf: new Date().toISOString(),
    profile: {
      name:       scholar.name,
      firstName:  scholar.first_name,
      track:      scholar.track,
      school:     scholar.school,
      city:       scholar.city,
      program:    scholar.program,
      cohort:     scholar.cohort,
      status:     scholar.status,
      currentSem: scholar.current_sem,
      gpaFloor:   scholar.gpa_floor,
    },
    academics: (academics ?? []).map(r => ({
      sem: r.sem, gpa: r.gpa, status: r.status, note: r.note ?? null,
    })),
    milestones: (milestones ?? []).map(r => ({
      name: r.name, state: r.state, sem: r.sem, amountPhp: r.amount_php,
    })),
    travels: (travels ?? []).map(r => ({
      dest: r.dest, sem: r.sem, state: r.state, amountPhp: r.amount_php,
    })),
    budgetBySem,
    expenses: {
      bySem:   expensesBySem,
      recent10: (expenses ?? []).slice(0, 10).map(e => ({
        id: e.id, item: e.item, amount: e.amount, qty: e.qty,
        cat: e.cat, date: e.date, sem: e.sem, vendor: e.vendor,
      })),
    },
    alerts: (alerts ?? []).map(a => ({
      id: a.id, severity: a.severity, title: a.title, sub: a.sub,
    })),
    deadlines: (deadlines ?? []).map(d => ({
      event: d.event, when: d.when_date, cat: d.cat, urgency: d.urgency,
    })),
    openActions: (actions ?? []).map(a => ({
      id: a.id, text: a.text, cat: a.cat,
    })),
    pendingSubmissions: (submissions ?? []).length,
  })
})
