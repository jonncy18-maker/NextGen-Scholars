// Scholar-scoped AI endpoint for student-facing pages.
// No JWT required — open to the student's own data only.
// Scholar key validation ensures one scholar cannot query another's data.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { tier1Resolve }             from '../ask/tier1.ts'
import { buildContext }             from '../ask/context.ts'
import { tier2Ask }                 from '../ask/tier2.ts'
import { tier3Ingest, tier3GradeIngest, tier3IngestClaude, tier3GradeIngestClaude, tier3EnglishIngestClaude } from '../ask/tier3.ts'

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
    scholar?:       string
    type?:          string
    text?:          string
    sem?:           string
    model?:         'gemini' | 'claude'
    file?:          { base64: string; mime: string }
    messages?:      { role: string; text: string }[]
    grades?:        unknown[]
    items?:         unknown[]
    session_type?:  string
    categories?:    string[]
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { scholar, type = 'query', text, sem, model: modelPref, file, messages, grades, items, categories } = body

  if (!scholar || !VALID_SCHOLARS.includes(scholar)) {
    return json({ error: 'Invalid or missing scholar key' }, 400)
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Expense receipt extraction — Tier 3 (student reviews, then submits via frontend)
  if (type === 'ingest') {
    if (!file && !text) return json({ error: 'Ingest requires file or text' }, 400)
    if (modelPref === 'claude') {
      const anthropicKey = Deno.env.get('ANTHROPIC_KEY')
      if (!anthropicKey) return json({ tier: 3, status: 'not_configured' }, 503)
      try {
        const t3 = await tier3IngestClaude({ text, file }, scholar, anthropicKey)
        if (t3.answered) return json({ tier: 3, items: t3.items, model: t3.model, escalated: t3.escalated })
        return json({ tier: 3, status: 'error', error: t3.error }, 502)
      } catch (err) {
        return json({ error: (err as Error).message ?? 'Ingest failed' }, 500)
      }
    }
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

  // English session extraction — Tier 3 (Claude Haiku → Sonnet; student reviews, then saves)
  if (type === 'english_ingest') {
    if (!text?.trim()) return json({ error: 'english_ingest requires text' }, 400)
    const cats: string[] = Array.isArray(categories) && categories.length
      ? categories
      : ['Free Conversation', 'Travel', 'Visa Interview', 'Medical English']
    const anthropicKey = Deno.env.get('ANTHROPIC_KEY')
    if (!anthropicKey) return json({ tier: 3, status: 'not_configured' }, 503)
    try {
      const t3 = await tier3EnglishIngestClaude(text, cats, anthropicKey)
      if (t3.answered) return json({ tier: 3, sessions: t3.sessions, model: t3.model, escalated: t3.escalated })
      return json({ tier: 3, status: 'error', error: t3.error }, 502)
    } catch (err) {
      return json({ error: (err as Error).message ?? 'English ingest failed' }, 500)
    }
  }

  // Grade report extraction — Tier 3 (student reviews, then saves via frontend)
  if (type === 'grade_ingest') {
    if (!file && !text) return json({ error: 'Grade ingest requires file or text' }, 400)
    if (modelPref === 'claude') {
      const anthropicKey = Deno.env.get('ANTHROPIC_KEY')
      if (!anthropicKey) return json({ tier: 3, status: 'not_configured' }, 503)
      try {
        const t3 = await tier3GradeIngestClaude({ text, file }, scholar, anthropicKey)
        if (t3.answered) return json({ tier: 3, grades: t3.grades, model: t3.model, escalated: t3.escalated })
        return json({ tier: 3, status: 'error', error: t3.error }, 502)
      } catch (err) {
        return json({ error: (err as Error).message ?? 'Grade ingest failed' }, 500)
      }
    }
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

  // Grade correction — apply a natural-language instruction to an extracted grades array
  if (type === 'grade_edit') {
    if (!text?.trim())       return json({ error: 'grade_edit requires instruction text' }, 400)
    if (!Array.isArray(grades)) return json({ error: 'grade_edit requires grades array' }, 400)
    const apiKey = Deno.env.get('GOOGLE_AI_KEY')
    if (!apiKey) return json({ error: 'AI not configured' }, 503)

    const prompt = `You are correcting AI-extracted grade entries before a student saves them.\n\nCurrent grades JSON:\n${JSON.stringify(grades, null, 2)}\n\nInstruction: ${text}\n\nReturn ONLY the corrected JSON array with the same structure (fields: subject, units, school, prelim, midterm, final_grade). No explanation, no markdown fences — raw JSON array only.`

    try {
      const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
      const res = await fetch(`${geminiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } },
        }),
      })
      const gJson = await res.json()
      const raw = gJson?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined
      if (!raw) return json({ error: 'AI returned no response' }, 502)
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) return json({ error: 'Could not parse corrected grades from AI response' }, 502)
      const corrected = JSON.parse(match[0])
      return json({ grades: corrected })
    } catch (err) {
      return json({ error: (err as Error).message ?? 'grade_edit failed' }, 500)
    }
  }

  // Expense correction — apply a natural-language instruction to an extracted items array
  if (type === 'expense_edit') {
    if (!text?.trim())        return json({ error: 'expense_edit requires instruction text' }, 400)
    if (!Array.isArray(items)) return json({ error: 'expense_edit requires items array' }, 400)
    const apiKey = Deno.env.get('GOOGLE_AI_KEY')
    if (!apiKey) return json({ error: 'AI not configured' }, 503)

    const prompt = `You are correcting AI-extracted expense items before the user saves them.\n\nCurrent items JSON:\n${JSON.stringify(items, null, 2)}\n\nInstruction: ${text}\n\nReturn ONLY the corrected JSON array with the same structure (fields: item, amount, qty, cat, date, vendor). No explanation, no markdown fences — raw JSON array only.`

    try {
      const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
      const res = await fetch(`${geminiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } },
        }),
      })
      const gJson = await res.json()
      const raw = gJson?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined
      if (!raw) return json({ error: 'AI returned no response' }, 502)
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) return json({ error: 'Could not parse corrected items from AI response' }, 502)
      const corrected = JSON.parse(match[0])
      return json({ items: corrected })
    } catch (err) {
      return json({ error: (err as Error).message ?? 'expense_edit failed' }, 500)
    }
  }

  // Grade analysis — Gemini generates a short academic commentary on extracted grades
  if (type === 'grade_analysis') {
    if (!Array.isArray(grades) || grades.length === 0) return json({ error: 'grade_analysis requires non-empty grades array' }, 400)
    const apiKey = Deno.env.get('GOOGLE_AI_KEY')
    if (!apiKey) return json({ error: 'AI not configured' }, 503)

    const gradeList = (grades as Array<Record<string, unknown>>).map(g => {
      const prelim     = g.prelim      != null ? parseFloat(String(g.prelim))      : null
      const midterm    = g.midterm     != null ? parseFloat(String(g.midterm))     : null
      const finalGrade = g.final_grade != null ? parseFloat(String(g.final_grade)) : null
      const vals = [prelim, midterm, finalGrade].filter((v): v is number => v != null && !isNaN(v))
      const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
      return { subject: g.subject, units: g.units, school: g.school, prelim, midterm, final: finalGrade, avg }
    })

    const totalUnits = gradeList.reduce((s, g) => s + (parseFloat(String(g.units)) || 0), 0)
    const validForWA = gradeList.filter(g => g.avg != null && g.units)
    const weightedAvg = validForWA.length && totalUnits
      ? validForWA.reduce((s, g) => s + (g.avg as number) * (parseFloat(String(g.units)) || 0), 0) / totalUnits
      : null

    const isUV = gradeList.some(g => g.school === 'uv')
    const scaleNote = isUV ? '(UV scale: 1.0 = highest, 5.0 = failing)' : '(K-12 percentage scale: 100% = highest)'

    const prompt = `You are an academic advisor for NextGen Scholars, a program supporting Filipino nursing students on a pathway to international licensure.

Scholar: ${scholar}${sem ? `, Semester: ${sem}` : ''}
Grade scale: ${scaleNote}

Subjects uploaded:
${gradeList.map(g => `- ${g.subject} (${g.units} units): Prelim=${g.prelim ?? '—'}, Mid=${g.midterm ?? '—'}, Final=${g.final ?? '—'}, Period Avg=${g.avg != null ? (g.avg as number).toFixed(2) : '—'}`).join('\n')}
${weightedAvg != null ? `\nWeighted Average: ${weightedAvg.toFixed(2)}` : ''}

Write a concise 2–3 sentence academic analysis. Cover: overall performance level, any subjects that stand out (strong or at-risk), and a brief encouraging observation. Be specific to these grades. Professional and warm tone. Plain text only — no markdown, no bullet points, no headers.`

    try {
      const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
      const res = await fetch(`${geminiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 512, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } },
        }),
      })
      const gJson = await res.json()
      const analysis = gJson?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined
      if (!analysis) return json({ error: 'AI returned no response' }, 502)
      return json({ analysis: analysis.trim() })
    } catch (err) {
      return json({ error: (err as Error).message ?? 'analysis failed' }, 500)
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
