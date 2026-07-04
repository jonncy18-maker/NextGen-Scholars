// Tier 2 — Gemini advisory layer.
//
// Called when Tier 1 cannot answer from the DB alone. Receives the user's
// question plus a compact scholar context bundle, calls Gemini, and returns
// a structured answer. Read-only: Gemini never writes to the database.

const GEMINI_MODEL = 'gemini-2.5-flash'
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
function compactContext(ctx) {
  const p = ctx.profile
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

export async function tier2Ask(
  question,
  ctx,
  apiKey,
  history,
) {
  const ctxBlock = `Scholar data:\n\`\`\`json\n${compactContext(ctx)}\n\`\`\`\n\n`

  // Build multi-turn contents. The context block is prepended to the first user turn.
  const contents = []
  if (history && history.length > 0) {
    history.forEach((m, i) => {
      contents.push({ role: m.role, parts: [{ text: i === 0 ? ctxBlock + m.text : m.text }] })
    })
    contents.push({ role: 'user', parts: [{ text: question }] })
  } else {
    contents.push({ role: 'user', parts: [{ text: `${ctxBlock}Question: ${question}` }] })
  }

  let res
  try {
    res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: NGS_SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.3,
          // 2.5-flash enables "thinking" by default, which spends output tokens
          // before the answer. Disable it to keep this advisory tier fast/cheap
          // and avoid empty responses under the maxOutputTokens cap.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })
  } catch (err) {
    return { answered: false, error: `Gemini network error: ${err.message}` }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let message = `Gemini API error ${res.status}`
    try {
      const parsed = JSON.parse(body)
      const inner = parsed?.error?.message
      if (inner) message = res.status === 429 ? `Gemini quota exceeded — ${inner.split('.')[0]}.` : inner
    } catch { /* leave default message */ }
    return { answered: false, error: message }
  }

  const json = await res.json()
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return { answered: false, error: 'Gemini returned an empty response.' }

  return { answered: true, answer: text, model: GEMINI_MODEL }
}

// ── Weekly cohort report (Tier 2) ─────────────────────────────────────────────
// Builds one Gemini call from every scholar's context bundle and returns a single
// shareable mentor update. Read-only — never writes to the DB.

const WEEKLY_REPORT_PROMPT = `\
Draft this week's mentor report for the NextGen Scholars cohort, using the data for every scholar below.

Structure the report in plain Markdown:
1. A 2–3 sentence cohort overview.
2. A "## Per scholar" section with one subsection per scholar (use their name as a heading). For each, give 3–5 tight bullets covering: academic standing (latest GPA vs the minimum floor), spending vs current-semester budget, OET/English progress vs the 200-hour target, the next pending milestone, the nearest upcoming deadline, open action items, and any active alerts.
3. A "## Needs attention this week" section listing the 3–5 most important items across the whole cohort, most urgent first.

Rules:
- Use only the data provided — never invent GPA numbers, amounts, hours, or dates.
- Use Philippine Peso (₱) for amounts.
- Be concise and practical, written so the mentor can paste it straight into a weekly update.
- If a scholar is missing data for a metric, say so briefly rather than guessing.`

export async function tier2WeeklyReport(
  contexts,
  apiKey,
) {
  const cohortBlock = contexts
    .map((c, i) => `Scholar ${i + 1} data:\n\`\`\`json\n${compactContext(c)}\n\`\`\``)
    .join('\n\n')

  const userText = `${cohortBlock}\n\nas-of: ${new Date().toISOString()}\n\n${WEEKLY_REPORT_PROMPT}`

  let res
  try {
    res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: NGS_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: {
          // Cohort report spans several scholars — allow more room than a single
          // advisory answer, but keep thinking off for speed/cost.
          maxOutputTokens: 2048,
          temperature: 0.3,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })
  } catch (err) {
    return { answered: false, error: `Gemini network error: ${err.message}` }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let message = `Gemini API error ${res.status}`
    try {
      const inner = JSON.parse(body)?.error?.message
      if (inner) message = res.status === 429 ? `Gemini quota exceeded — ${inner.split('.')[0]}.` : inner
    } catch { /* leave default message */ }
    return { answered: false, error: message }
  }

  const json = await res.json()
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return { answered: false, error: 'Gemini returned an empty response.' }

  return { answered: true, answer: text, model: GEMINI_MODEL }
}
