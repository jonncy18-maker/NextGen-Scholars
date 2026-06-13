// Public program-info endpoint — answers visitor questions about NextGen Scholars
// using only a static program description. No auth required. No scholar data exposed.

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, apikey, x-client-info',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// Static program description — the only context Gemini receives.
// No Supabase tables are queried. No scholar data is present here.
const PROGRAM_INFO = `\
NextGen Scholars (NGS) is a privately funded mentorship program that supports
Filipino nursing students on a pathway toward international nursing licensure.

Pathway:
  1. Philippines — complete BSN (Bachelor of Science in Nursing) or Grade 11 pre-nursing
  2. OET — Occupational English Test (Band 350+ required for AHPRA eligibility)
  3. NCLEX-RN — US nursing licensure board exams
  4. AHPRA — Australian Health Practitioner Regulation Agency registration (Australia)

Tracks:
- BSN Track: for active nursing degree students in the Philippines
- Pre-nursing Track: for Grade 11 students on the science/nursing pathway

What mentorship includes:
- One-on-one guidance from a dedicated program mentor
- Study planning and milestone tracking
- OET English proficiency preparation support
- Academic progress monitoring
- Application and licensure pathway guidance
- Program support to help scholars reach each milestone

Who can apply:
- Motivated Filipino nursing students (BSN or Grade 11)
- Must be serious about pursuing an international nursing career
- Applications are reviewed individually; the program is small and selective

How to apply:
- Complete the application form on the NextGen Scholars website
- The mentor reviews all applications and contacts shortlisted candidates
- Shortlisted applicants go through a brief interview/assessment

Program values:
- Student-centered, practical, and milestone-driven
- Grounded in real scholarship tracks (OET, NCLEX, AHPRA)
- Transparent progress tracking and accountability`

const SYSTEM_PROMPT = `\
You are a friendly and helpful program information assistant for NextGen Scholars (NGS).

Your role is to answer questions from prospective students and visitors about the NextGen Scholars program. You should be warm, encouraging, and informative.

Rules you must follow:
- Only answer based on the program information provided below
- Do not discuss or reveal any specific scholar's personal information, GPA, expenses, health, or private program data
- If asked about a specific named scholar's private details, politely decline and redirect
- Keep answers concise (under 200 words unless clearly needed)
- If something is not covered in the program info, say you don't have that detail and suggest reaching out directly
- Never fabricate costs, guarantees, timelines, or specific numbers not mentioned in the context
- Do not invent scholarships, stipends, or financial figures
- Respond in a tone that is welcoming to prospective applicants`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('GOOGLE_AI_KEY')
  if (!apiKey) return json({ error: 'AI not configured', status: 'not_configured' }, 503)

  let body: { text?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text)          return json({ error: 'Question is required' }, 400)
  if (text.length > 500) return json({ error: 'Question must be under 500 characters' }, 400)

  const userMessage = `Program information:\n${PROGRAM_INFO}\n\nVisitor question: ${text}`

  let res: Response
  try {
    res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          maxOutputTokens: 512,
          temperature: 0.4,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })
  } catch (err) {
    return json({ error: `Network error: ${(err as Error).message}` }, 502)
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    let message = `Gemini error ${res.status}`
    try {
      const parsed = JSON.parse(raw)
      const inner = parsed?.error?.message as string | undefined
      if (inner) message = res.status === 429 ? `Usage limit reached — try again shortly.` : inner
    } catch { /* keep default */ }
    return json({ error: message }, 502)
  }

  const geminiJson = await res.json()
  const answer = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined
  if (!answer) return json({ error: 'No response from AI' }, 502)

  return json({ answer, model: GEMINI_MODEL })
})
