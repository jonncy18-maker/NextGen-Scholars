// Tier 2 — Gemini advisory layer.
//
// Called when Tier 1 cannot answer from the DB alone. Receives the user's
// question plus a compact scholar context bundle, calls Gemini, and returns
// a structured answer. Read-only: Gemini never writes to the database.

import { ScholarContext } from './context.ts'

const GEMINI_MODEL = 'gemini-1.5-flash'
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const NGS_SYSTEM_PROMPT = `\
You are an AI advisor embedded in the NextGen Scholars (NGS) mentor dashboard.

NGS is a privately funded mentorship program supporting Filipino nursing students on a pathway toward international licensure:
  Philippines (BSN/Grade 11) → OET (English proficiency, band 350+) → NCLEX-RN (US nursing boards) → AHPRA (Australian registration)

You are speaking directly with the program mentor. Your role is:
- Advisory only — you cannot modify any data
- Grounded in the scholar's real data provided below
- Concise, practical, mentor-focused
- Honest when you don't know something or when the question is outside your knowledge

Rules:
- Use Philippine Peso (₱) for amounts
- Reference specific data from the context when relevant
- If the question requires regulatory details you are uncertain about, say so and suggest verifying with the official body (AHPRA, NCSBN, etc.)
- Never fabricate GPA numbers, expense amounts, or dates — use only what is in the context
- Keep responses under 300 words unless a longer answer is clearly needed`

// Serialise only the fields an LLM needs for advisory — omit schema registry
function compactContext(ctx: ScholarContext): string {
  const p = ctx.profile as Record<string, unknown> | null
  const profile = p ? {
    name:        p.name,
    track:       p.track,
    program:     p.program,
    status:      p.status,
    currentSem:  p.current_sem,
    gpaFloor:    p.gpa_floor,
    cardStage:   p.card_stage,
    cardYear:    p.card_year,
  } : null

  return JSON.stringify({
    scholar:    ctx.scholar,
    asOf:       ctx.asOf,
    profile,
    academics:  ctx.academics,
    expenses: {
      total:    ctx.expenses.total,
      bySem:    ctx.expenses.bySem,
      categories: ctx.expenses.categories,
      recent5:  ctx.expenses.recent10.slice(0, 5),
    },
    budget:           ctx.budget,
    milestones:       ctx.milestones,
    alerts:           ctx.alerts,
    deadlines:        ctx.deadlines.slice(0, 8),
    openActions:      ctx.openActions,
    english:          ctx.english,
    pendingSubmissions: ctx.pendingSubmissions,
  }, null, 2)
}

export interface Tier2Result {
  answered: boolean
  answer?:  string
  model?:   string
  error?:   string
}

export async function tier2Ask(
  question: string,
  ctx: ScholarContext,
  apiKey: string,
): Promise<Tier2Result> {
  const userMessage =
    `Scholar data:\n\`\`\`json\n${compactContext(ctx)}\n\`\`\`\n\nQuestion: ${question}`

  let res: Response
  try {
    res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: NGS_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
      }),
    })
  } catch (err) {
    return { answered: false, error: `Gemini network error: ${(err as Error).message}` }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let message = `Gemini API error ${res.status}`
    try {
      const parsed = JSON.parse(body)
      const inner = parsed?.error?.message as string | undefined
      if (inner) message = res.status === 429 ? `Gemini quota exceeded — ${inner.split('.')[0]}.` : inner
    } catch { /* leave default message */ }
    return { answered: false, error: message }
  }

  const json = await res.json()
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined
  if (!text) return { answered: false, error: 'Gemini returned an empty response.' }

  return { answered: true, answer: text, model: GEMINI_MODEL }
}
