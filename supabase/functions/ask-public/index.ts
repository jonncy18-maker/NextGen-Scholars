// Public program-info endpoint — answers visitor questions about NextGen Scholars
// using program details stored in Supabase config (key: 'program_details').
// No auth required. No scholar data exposed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// Fallback program info used when the config table has no 'program_details' row.
const FALLBACK_INFO = `\
NEXTGEN SCHOLARS — PROGRAM DETAILS

NextGen Scholars (NGS) is a privately funded mentorship program that supports Filipino nursing students on a pathway toward international nursing licensure.

PATHWAY
1. Philippines — complete BSN (Bachelor of Science in Nursing) or Grade 11 pre-nursing
2. OET — Occupational English Test (Band 350+ required for AHPRA eligibility)
3. NCLEX-RN — US nursing licensure board exams
4. AHPRA — Australian Health Practitioner Regulation Agency registration (Australia)

TRACKS
- BSN Track: for active nursing degree students in the Philippines
- Pre-nursing Track: for Grade 11 students on the science/nursing pathway

WHAT MENTORSHIP INCLUDES
- One-on-one guidance from a dedicated program mentor
- Study planning and milestone tracking
- OET English proficiency preparation support
- Academic progress monitoring
- Application and licensure pathway guidance
- Program support to help scholars reach each milestone

WHO CAN APPLY
- Motivated Filipino nursing students (BSN or Grade 11)
- Must be serious about pursuing an international nursing career
- Applications are reviewed individually; the program is small and selective

HOW TO APPLY
- Complete the application form on the NextGen Scholars website
- The mentor reviews all applications and contacts shortlisted candidates
- Shortlisted applicants go through a brief interview/assessment

---

US IMMERSION PROGRAM

NextGen Scholars includes a structured 3-month US Immersion experience as part of the scholar development pathway.

OVERVIEW
The US Immersion is a professional and cultural exchange experience designed to transform competence into confidence through real-world exposure. Scholars gain cultural immersion, professional growth, leadership development, and English mastery across diverse US environments.

VISION
Gain exposure through real-world immersion, cultural connection, English mastery, and self-leadership across diverse US environments.

OBJECTIVES
- Cultural Immersion: Experience the rhythm of everyday US life — from New York's energy to Nashville's southern charm.
- Professional & Personal Growth: Think, speak, live in English. Build independence, adaptability, and confidence while learning from diverse communities.
- Leadership & Global Mindset: Cultivate resilience, adaptability, and purpose — the foundation of future-ready global citizens.

EXPECTED OUTCOMES
- Enhanced adaptability
- Deeper understanding of US culture
- Strengthened independence and initiative
- Functional English Proficiency (B2+)
- Increased confidence and self-leadership

TRAVEL ITINERARY
The immersion follows a structured journey across the United States:
1. New York City, NY — 3 days (global exposure, first city on arrival)
2. Carmel, IN — Visit Alexandria, Anderson, Carmel & Fishers; Indianapolis Zoo
3. Chicago, IL — Architectural discovery, structured big city experience (weekend)
4. Mammoth Cave, KY — Historical landmark, rural Kentucky exposure (weekend)
5. King's Island, OH — Theme park experience, Midwest culture (weekend)
6. Nashville, TN — Southern charm, live country music (weekend)
7. Miami, FL & Caribbean Cruise — Latin-American culture, 7-day Caribbean cruise (week-long)
8. Return to Cebu

STUDY DURING IMMERSION
Scholars continue structured PNLE study throughout the immersion:
- 6-8 study sessions per week
- 3-4 hours per day of guided self-review and flashcard recall
- Mock practice and self-tracking
- Resources: CBRC-Hybrid (recorded lectures, digital handouts, module quizzes, score tracking, mock exams, mobile app)
- All CBRC Hybrid resources remain fully available overseas; in-person review completed upon return to the Philippines

US ORIENTATION
Scholars are prepared for US daily life covering:
- US Geography: 4 time zones, major regions (Northeast, South, Midwest, West)
- Financial System: Cashless culture (cards, Apple Pay, tap-to-pay), sales tax 6-10% added at checkout, tipping 15-20% expected at restaurants and services
- Climate: Varies by region — cold winters in Midwest/Northeast, mild West Coast, hot humid summers in the South

US VISA REQUIREMENTS
The US Immersion requires a student visa. To be eligible, scholars must meet:
1. Good academic standing — minimum grade floor of 81% (this threshold is adjustable by the mentor based on individual circumstances)
2. Satisfactory completion of the Summer English Bootcamp held the summer before the visa interview — this is required for two reasons:
   a. To improve the scholar's English proficiency ahead of the trip
   b. To prepare the scholar for the in-person US visa interview, maximizing the likelihood of approval
   Note: The bootcamp preparation process can be intensive.

ELIGIBILITY FOR US IMMERSION
The US Immersion program is available exclusively to NGN (nursing) scholars. It is not available to scholars on other tracks.

---

PROGRAM VALUES
- Student-centered, practical, and milestone-driven
- Grounded in real scholarship tracks (OET, NCLEX, AHPRA)
- Transparent progress tracking and accountability
- Global exposure as a core pillar of scholar development`

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

  let body: { text?: unknown; messages?: { role: string; text: string }[] }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text)             return json({ error: 'Question is required' }, 400)
  if (text.length > 500) return json({ error: 'Question must be under 500 characters' }, 400)

  // Load program details from Supabase config table (falls back to hardcoded text)
  let programInfo = FALLBACK_INFO
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (supabaseUrl && serviceKey) {
      const sb = createClient(supabaseUrl, serviceKey)
      const { data } = await sb.from('config').select('value').eq('key', 'program_details').maybeSingle()
      if (data?.value) programInfo = data.value
    }
  } catch { /* use fallback */ }

  // Build conversation history for multi-turn support
  const history = Array.isArray(body.messages)
    ? body.messages
        .filter(m => (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text)
        .map(m => ({ role: m.role as 'user' | 'model', parts: [{ text: m.text }] }))
    : []

  const firstUserText = `Program information:\n${programInfo}\n\nVisitor question: ${text}`

  // Build contents array: prior history + current turn
  const contents = history.length > 0
    ? [
        { role: 'user',  parts: [{ text: firstUserText }] },
        ...history.slice(1),
        { role: 'user',  parts: [{ text }] },
      ]
    : [{ role: 'user', parts: [{ text: firstUserText }] }]

  let res: Response
  try {
    res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
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
