// Scholar-scoped AI endpoint for student-facing pages.
// No JWT required — open to the student's own data only.
// Scholar key validation ensures one scholar cannot query another's data.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { tier1Resolve }             from '../ask/tier1.ts'
import { buildContext }             from '../ask/context.ts'
import { tier2Ask }                 from '../ask/tier2.ts'
import { tier3Ingest, tier3GradeIngest } from '../ask/tier3.ts'

const VALID_SCHOLARS = ['claire', 'april', 'aljane']

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, apikey, x-client-info',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

  let body: {
    scholar?:  string
    type?:     string
    text?:     string
    sem?:      string
    file?:     { base64: string; mime: string }
    messages?: { role: string; text: string }[]
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { scholar, type = 'query', text, sem, file, messages } = body

  if (!scholar || !VALID_SCHOLARS.includes(scholar)) {
    return json({ error: 'Invalid or missing scholar key' }, 400)
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Expense receipt extraction — Tier 3 only (student reviews, then submits via frontend)
  if (type === 'ingest') {
    if (!file && !text) return json({ error: 'Ingest requires file or text' }, 400)
    const apiKey = Deno.env.get('GOOGLE_AI_KEY')
    if (!apiKey) return json({ tier: 3, status: 'not_configured' }, 503)
    try {
      const t3 = await tier3Ingest({ text, file }, scholar, apiKey)
      if (t3.answered) return json({ tier: 3, items: t3.items, model: t3.model })
      return json({ tier: 3, status: 'error', error: t3.error }, 502)
    } catch (err) {
      return json({ error: (err as Error).message ?? 'Ingest failed' }, 500)
    }
  }

  // Grade report extraction — Tier 3 only (student reviews, then saves via frontend)
  if (type === 'grade_ingest') {
    if (!file && !text) return json({ error: 'Grade ingest requires file or text' }, 400)
    const apiKey = Deno.env.get('GOOGLE_AI_KEY')
    if (!apiKey) return json({ tier: 3, status: 'not_configured' }, 503)
    try {
      const t3 = await tier3GradeIngest({ text, file }, scholar, apiKey)
      if (t3.answered) return json({ tier: 3, grades: t3.grades, model: t3.model })
      return json({ tier: 3, status: 'error', error: t3.error }, 502)
    } catch (err) {
      return json({ error: (err as Error).message ?? 'Grade ingest failed' }, 500)
    }
  }

  // Query — Tier 1 (deterministic DB) then Tier 2 (Gemini advisory)
  if (!text?.trim()) return json({ error: 'Query requires text' }, 400)

  // Privacy guard: decline any query that mentions another scholar by name
  const otherScholars = VALID_SCHOLARS.filter(s => s !== scholar)
  const lowerText = text.toLowerCase()
  if (otherScholars.some(name => lowerText.includes(name))) {
    return json({
      tier: 1,
      answered: true,
      intent: 'privacy_guard',
      answer: `For privacy reasons, I can only share information about your own progress — not other scholars'. If you have questions about the program overall, try the Ask AI on the homepage.`,
    })
  }

  try {
    const t1 = await tier1Resolve(text, scholar, sb)
    if (t1.answered) return json({ tier: 1, ...t1 })

    const apiKey = Deno.env.get('GOOGLE_AI_KEY')
    if (!apiKey) return json({ tier: 2, status: 'not_configured' }, 503)

    const ctx = await buildContext(scholar, sb)
    const history = (messages || [])
      .filter(m => m.role === 'user' || m.role === 'model')
      .map(m => ({ role: m.role as 'user' | 'model', text: m.text }))
    const t2 = await tier2Ask(text, ctx, apiKey, history.length ? history : undefined)

    if (t2.answered) return json({ tier: 2, answer: t2.answer, model: t2.model })
    return json({ tier: 2, status: 'error', error: t2.error }, 502)
  } catch (err) {
    return json({ error: (err as Error).message ?? 'Query failed' }, 500)
  }
})
