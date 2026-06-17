// Orchestrator entry point for the NGS AI Intelligence Layer.
//
// Routing rules (evaluated in order):
//   type=ingest + file present  → Tier 3 (Gemini 2.5 Flash — multimodal extraction)
//   type=ingest + text          → Tier 3 (Gemini 2.5 Flash — structured text parsing)
//   type=query                  → Tier 1 (DB resolver), escalates to Tier 2 (Gemini) if needed

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { tier1Resolve } from './tier1.ts'
import { buildContext } from './context.ts'
import { tier2Ask, tier2WeeklyReport } from './tier2.ts'
import { tier3Ingest, tier3GradeIngest, tier3IngestClaude, tier3GradeIngestClaude } from './tier3.ts'
import { resolveSendAction } from './action.ts'

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

interface AskBody {
  scholar:   string
  scholars?: string[]
  type:      'query' | 'ingest' | 'grade_ingest' | 'coach' | 'action' | 'weekly_report'
  text?:     string
  sem?:      string
  file?:     { base64: string; mime: string }
  model?:    'gemini' | 'claude'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: { user }, error: authErr } = await sb.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  let body: AskBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { scholar, type, text, sem, file, model: modelPref } = body
  // weekly_report operates over the whole cohort, so it does not require a single scholar.
  if (!scholar && type !== 'weekly_report') return json({ error: 'Missing required field: scholar' }, 400)
  if (type !== 'query' && type !== 'ingest' && type !== 'grade_ingest' && type !== 'coach' && type !== 'action' && type !== 'weekly_report') {
    return json({ error: 'Field "type" must be "query", "ingest", "grade_ingest", "coach", "action", or "weekly_report"' }, 400)
  }

  // type === 'weekly_report' — build context for every scholar and ask Tier 2
  // (Gemini) to draft a single shareable cohort update. Read-only.
  if (type === 'weekly_report') {
    const geminiKey = Deno.env.get('GOOGLE_AI_KEY')
    if (!geminiKey) return json({ tier: 2, status: 'not_configured', hint: 'Add GOOGLE_AI_KEY to Supabase secrets.' }, 503)
    try {
      let keys = Array.isArray(body.scholars) ? body.scholars.filter(Boolean) : []
      if (keys.length === 0) {
        const { data } = await sb.from('scholars').select('scholar_key').order('scholar_key')
        keys = (data ?? []).map((r: { scholar_key: string }) => r.scholar_key)
      }
      if (keys.length === 0) return json({ tier: 2, status: 'error', error: 'No scholars found.' }, 502)
      const contexts = await Promise.all(keys.map(k => buildContext(k, sb)))
      const t2 = await tier2WeeklyReport(contexts, geminiKey)
      if (t2.answered) return json({ tier: 2, type: 'weekly_report', report: t2.answer, model: t2.model })
      return json({ tier: 2, status: 'error', error: t2.error }, 502)
    } catch (err) {
      return json({ error: (err as Error).message ?? 'Weekly report generation failed' }, 500)
    }
  }

  // type === 'action' — resolve a free-text "record a send" request into the
  // unsent items it covers. Returns a plan; the client performs the writes.
  if (type === 'action') {
    if (!text) return json({ error: 'Action request requires text' }, 400)
    const geminiKey = Deno.env.get('GOOGLE_AI_KEY')
    if (!geminiKey) return json({ status: 'not_configured', hint: 'Add GOOGLE_AI_KEY to Supabase secrets.' }, 503)
    try {
      const result = await resolveSendAction(scholar, text, sb, geminiKey)
      return json(result)
    } catch (err) {
      return json({ error: (err as Error).message ?? 'Action failed' }, 500)
    }
  }

  if (type === 'ingest') {
    if (!file && !text) return json({ error: 'Ingest request requires file or text' }, 400)

    const geminiKey = Deno.env.get('GOOGLE_AI_KEY')
    if (!geminiKey) return json({ tier: 3, status: 'not_configured', hint: 'Add GOOGLE_AI_KEY to Supabase secrets.' }, 503)
    try {
      const t3 = await tier3Ingest({ text, file }, scholar, geminiKey)
      if (t3.answered) return json({ tier: 3, items: t3.items, model: t3.model })
      return json({ tier: 3, status: 'error', error: t3.error }, 502)
    } catch (err) {
      return json({ error: (err as Error).message ?? 'Ingest failed' }, 500)
    }
  }

  // type === 'grade_ingest' — Tier 3 extracts grade entries from a screenshot / text
  if (type === 'grade_ingest') {
    if (!file && !text) return json({ error: 'Grade ingest request requires file or text' }, 400)

    const geminiKey = Deno.env.get('GOOGLE_AI_KEY')
    if (!geminiKey) return json({ tier: 3, status: 'not_configured', hint: 'Add GOOGLE_AI_KEY to Supabase secrets.' }, 503)
    try {
      const t3 = await tier3GradeIngest({ text, file }, scholar, geminiKey)
      if (t3.answered) return json({ tier: 3, grades: t3.grades, model: t3.model })
      return json({ tier: 3, status: 'error', error: t3.error }, 502)
    } catch (err) {
      return json({ error: (err as Error).message ?? 'Grade ingest failed' }, 500)
    }
  }

  // type === 'coach' — build context, call Tier 2 with a canned coaching prompt
  if (type === 'coach') {
    const geminiKey = Deno.env.get('GOOGLE_AI_KEY')
    if (!geminiKey) {
      return json({ tier: 2, status: 'not_configured', hint: 'Add GOOGLE_AI_KEY to Supabase secrets.' }, 503)
    }
    try {
      const ctx  = await buildContext(scholar, sb)
      const p    = ctx.profile as Record<string, unknown> | null
      const name = (p?.name as string | undefined) ?? scholar
      const prompt = `Draft a mentor coaching update for ${name}. Write 3–5 concise bullet points covering: (1) current academic standing — GPA vs the minimum floor, (2) total invested vs budget allocation and burn rate, (3) English study progress vs the 200-hour OET target, (4) any open actions or upcoming deadlines that need attention, (5) any active alerts that need attention. Each bullet should be one sentence. Write in plain English, practical and direct, suitable for a mentor check-in message. Use ₱ for peso amounts.`
      const t2   = await tier2Ask(prompt, ctx, geminiKey)
      if (t2.answered) return json({ tier: 2, type: 'coach', note: t2.answer, model: t2.model })
      return json({ tier: 2, status: 'error', error: t2.error }, 502)
    } catch (err) {
      return json({ error: (err as Error).message ?? 'Coach note generation failed' }, 500)
    }
  }

  // type === 'query'
  if (!text?.trim()) return json({ error: 'Query request requires text' }, 400)

  // Tier 1 — DB resolver (free, deterministic, no LLM)
  try {
    const t1 = await tier1Resolve(text, scholar, sb)
    if (t1.answered) return json({ tier: 1, ...t1 })

    // Tier 1 couldn't answer — build context and escalate to Tier 2 (Gemini advisory)
    const geminiKey = Deno.env.get('GOOGLE_AI_KEY')
    if (!geminiKey) {
      return json({ tier: 2, status: 'not_configured', hint: 'Add GOOGLE_AI_KEY to Supabase secrets.' }, 503)
    }

    const ctx = await buildContext(scholar, sb)
    const t2  = await tier2Ask(text, ctx, geminiKey)

    if (t2.answered) return json({ tier: 2, answer: t2.answer, model: t2.model })
    return json({ tier: 2, status: 'error', error: t2.error }, 502)
  } catch (err) {
    return json({ error: (err as Error).message ?? 'Query failed' }, 500)
  }
})
