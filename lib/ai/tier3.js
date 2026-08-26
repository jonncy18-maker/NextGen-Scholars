// Tier 3 — multimodal ingestion.
// Extracts structured data from uploaded images or pasted text.
// Returns JSON for human review — does NOT write to the database.
// Handles three extraction types: expense line items, grade entries, and
// English study sessions.
//
// Provider is caller-selected: the mentor's authenticated /api/ask routes
// through Claude (the AI brain for signed-in accounts); the unauthenticated
// /api/ask-scholar fallback stays on Gemini, same as the public routes.
// Default is 'gemini' so existing call sites that don't pass a provider keep
// their current behavior.

import { EXPENSE_CATS } from '../../src/constants.js'
import { CLAUDE_MODEL, callClaude, textFromMessage } from './claude.js'

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// EXPENSE_CATS comes from src/constants.js rather than a local copy. This file
// previously carried its own list of 12 of the 21 categories, missing every
// travel and milestone one — it only feeds the prompt (unlike expense-edit.js,
// which also coerced against it, silently rewriting categories), but the effect
// was still real: a flight or hotel receipt had no correct category to choose
// from and came back as 'Other'.

function stripFence(raw) {
  return raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
}

// Claude vision content block for an uploaded file — image types go through
// the `image` block, PDFs through `document`; everything else this app
// uploads (receipt/report photos) is one of those two.
function claudeFileBlock(file) {
  const type = file.mime === 'application/pdf' ? 'document' : 'image'
  return { type, source: { type: 'base64', media_type: file.mime, data: file.base64 } }
}

async function callClaudeJson({ apiKey, system, userText, file, maxTokens }) {
  const content = []
  if (file) content.push(claudeFileBlock(file))
  content.push({ type: 'text', text: userText })

  const res = await callClaude({
    apiKey,
    system,
    messages: [{ role: 'user', content }],
    maxTokens,
  })
  if (!res.ok) return { answered: false, error: res.error }
  const rawText = textFromMessage(res.message)
  if (!rawText) return { answered: false, error: 'Claude returned an empty response.' }
  try {
    const parsed = JSON.parse(stripFence(rawText))
    return { answered: true, parsed, rawText, model: CLAUDE_MODEL }
  } catch {
    return { answered: false, error: `Could not parse Claude response as JSON: ${rawText.slice(0, 300)}` }
  }
}

async function callGeminiJson({ apiKey, systemPrompt, userText, file, maxTokens, jsonMime = true }) {
  const parts = []
  if (file) parts.push({ inlineData: { mimeType: file.mime, data: file.base64 } })
  parts.push({ text: userText })

  let res
  try {
    res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method:  'POST',
      // Bypass Next's Data Cache — a POST fetch from a route handler is cached
      // by url+body otherwise (see CLAUDE.md "Neon driver ... Data Cache").
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          maxOutputTokens:  maxTokens,
          temperature:      0.1,
          thinkingConfig:   { thinkingBudget: 0 },
          ...(jsonMime ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    })
  } catch (err) {
    return { answered: false, error: `Network error calling Gemini: ${err.message}` }
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

  const data = await res.json()
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!rawText.trim()) return { answered: false, error: 'Gemini returned an empty response.' }

  try {
    const parsed = JSON.parse(stripFence(rawText))
    return { answered: true, parsed, rawText, model: GEMINI_MODEL }
  } catch {
    return { answered: false, error: `Could not parse Gemini response as JSON: ${rawText.slice(0, 300)}` }
  }
}

export async function tier3Ingest(
  options,
  _scholar,
  apiKey,
  provider = 'gemini',
) {
  const today = new Date().toISOString().slice(0, 10)

  const systemPrompt = `You are an expense extraction assistant for NextGen Scholars, a mentorship program for Filipino nursing students.

Extract ALL expense line items from the input. The input may be a scanned/pasted receipt or document, OR a mentor typing a plain-language, free-flow description of what was spent (e.g. "Claire spent 500 on jeepney fare today", "paid 3,500 tuition and 850 for two nursing textbooks", "120 lunch, 65 snacks"). Treat conversational, terse, and receipt-style input the same way — pull out every expense mentioned. Return ONLY a JSON array — no prose, no markdown fences, no explanation.

Each object in the array must follow this exact schema:
{
  "item":   string,   // descriptive name of the expense item
  "amount": number,   // unit price in Philippine Peso (PHP) — plain number, no currency symbols
  "qty":    number,   // quantity (default 1 if not specified)
  "cat":    string,   // MUST be one of: ${EXPENSE_CATS.join(', ')}
  "date":   string,   // ISO 8601 YYYY-MM-DD (use stated date; "today"/unclear → ${today})
  "vendor": string    // vendor or merchant name (empty string "" if not shown)
}

Rules:
- Extract EVERY line item — do not summarise or merge distinct items
- amount is the UNIT price; qty is the count (total = amount × qty)
- For tuition receipts: one object per fee line
- Interpret natural-language money references ("₱500", "500 pesos", "500php", "1.2k" → 1200) as plain numbers
- Resolve relative dates: "today" → ${today}; if no date is stated, use ${today}
- Choose the most specific category; default to "Other" if none fits
- Numbers must be plain numbers — never include commas, peso signs, or quotes
- If the input truly mentions no spending at all (e.g. a question or greeting), return []
- Your entire response must be a valid JSON array starting with [ and ending with ]

Examples:
Input: "Claire spent 500 on jeepney fare today"
Output: [{"item":"Jeepney fare","amount":500,"qty":1,"cat":"Living Expenses","date":"${today}","vendor":""}]
Input: "paid 3500 tuition and 850 for two nursing textbooks"
Output: [{"item":"Tuition","amount":3500,"qty":1,"cat":"Tuition","date":"${today}","vendor":""},{"item":"Nursing textbook","amount":425,"qty":2,"cat":"Books","date":"${today}","vendor":""}]`

  const userText = options.text
    ? `Receipt / document text:\n\n${options.text}`
    : 'Extract all expense line items from the image above.'

  const result = provider === 'claude'
    ? await callClaudeJson({ apiKey, system: systemPrompt, userText, file: options.file, maxTokens: 4096 })
    : await callGeminiJson({ apiKey, systemPrompt, userText, file: options.file, maxTokens: 4096 })

  if (!result.answered) return result
  if (!Array.isArray(result.parsed)) {
    return { answered: false, error: `Could not parse ${provider === 'claude' ? 'Claude' : 'Gemini'} response as JSON: ${result.rawText.slice(0, 300)}` }
  }
  return { answered: true, items: result.parsed, rawText: result.rawText, model: result.model }
}

// ── Grade ingestion ───────────────────────────────────────────────────────────

export async function tier3GradeIngest(
  options,
  _scholar,
  apiKey,
  provider = 'gemini',
) {
  const systemPrompt = `You are a grade extraction assistant for NextGen Scholars, a mentorship program for Filipino nursing students.

Extract ALL subject grade entries from the provided grade report, transcript, or screenshot. Return ONLY a JSON array — no prose, no markdown fences, no explanation.

Each object must follow this exact schema:
{
  "subject":     string,         // full subject name exactly as shown
  "units":       number,         // credit units (default 3 if not shown)
  "school":      "uv" | "k12",  // "uv" for UV 1.0–5.0 scale, "k12" for DepEd percentage scale
  "prelim":      number | null,  // prelim / first-period grade (null if not shown)
  "midterm":     number | null,  // midterm / second-period grade (null if not shown)
  "final_grade": number | null   // final / third-period grade (null if not shown)
}

Rules:
- UV scale: grades are 1.00–5.00 (lower is better; 1.00 = highest, 5.00 = failing)
- K-12 scale: grades are 0–100 percentages (higher is better)
- If only a single final grade is given, put it in final_grade and leave prelim/midterm null
- K-12 DepEd report cards ("Report on Learning Progress and Achievement") list
  quarters (1–4) plus a single "FINAL GRADE" column per learning area — that
  FINAL GRADE column is already the school's own computed result, NOT a raw
  score to average further. Map it straight to final_grade; if quarter columns
  are present too, put Quarter 1 in prelim and Quarter 2 in midterm for
  reference, but final_grade must always be the report card's own Final Grade
  value, never something you recompute
- MAPEH is ONE subject with ONE Final Grade on these report cards, even though
  it's commonly broken out into Music/Arts/PE/Health sub-rows underneath it —
  those sub-rows are display detail for the same MAPEH grade, not separate
  subjects. Extract exactly one "MAPEH" entry using MAPEH's own row; do NOT
  create separate Music/Arts/PE/Health entries
- Skip subject rows with no grades at all (e.g. an ungraded "Homeroom Guidance"
  row) rather than emitting a row with every grade field null
- units must be a positive number; use 3 if not shown
- school: detect from the grade scale used; default "uv" if unclear
- Extract every genuinely graded subject row — do not skip any, and do not
  duplicate or split any
- If the document contains no grade data, return []
- Your entire response must be a valid JSON array starting with [ and ending with ]`

  const userText = options.text
    ? `Grade report / transcript text:\n\n${options.text}`
    : 'Extract all subject grade entries from the image above.'

  const result = provider === 'claude'
    ? await callClaudeJson({ apiKey, system: systemPrompt, userText, file: options.file, maxTokens: 4096 })
    : await callGeminiJson({ apiKey, systemPrompt, userText, file: options.file, maxTokens: 4096, jsonMime: false })

  if (!result.answered) return result
  if (!Array.isArray(result.parsed)) {
    return { answered: false, error: `Could not parse ${provider === 'claude' ? 'Claude' : 'Gemini'} response as JSON: ${result.rawText.slice(0, 300)}` }
  }
  return { answered: true, grades: result.parsed, rawText: result.rawText, model: result.model }
}

// ── English session ingestion ───────────────────────────────────────────────

export async function tier3EnglishIngest(
  text,
  categories,
  apiKey,
  provider = 'gemini',
) {
  const today = new Date().toISOString().slice(0, 10)
  const systemPrompt = `You are an English study session extraction assistant for NextGen Scholars, a mentorship program for Filipino nursing students.

Extract all English practice sessions from the provided text. Return ONLY a JSON array — no prose, no markdown fences, no explanation.

Each object in the array must follow this exact schema:
{
  "date":             string,  // ISO 8601 YYYY-MM-DD — use date mentioned; if today or unclear, use ${today}
  "duration_minutes": number,  // total minutes for this session (positive integer)
  "category":         string,  // MUST be exactly one of: ${categories.join(', ')}
  "notes":            string   // brief description of what was practised (empty string "" if none)
}

Rules:
- Create one entry per distinct activity or time block
- duration_minutes must be a positive integer — convert "1 hour" → 60, "30 minutes" → 30, "1.5 hours" → 90
- category must match exactly one of the provided options (choose the closest match)
- If a session spans multiple categories, create a separate entry for each
- Return [] if no session data can be found in the text
- Your entire response must be a valid JSON array starting with [ and ending with ]`

  const userText = `English study session summary:\n\n${text}`

  const result = provider === 'claude'
    ? await callClaudeJson({ apiKey, system: systemPrompt, userText, maxTokens: 4096 })
    : await callGeminiJson({ apiKey, systemPrompt, userText, maxTokens: 4096, jsonMime: false })

  if (!result.answered) return result
  if (!Array.isArray(result.parsed)) {
    return { answered: false, error: `Could not parse ${provider === 'claude' ? 'Claude' : 'Gemini'} response as JSON: ${result.rawText.slice(0, 300)}` }
  }
  return { answered: true, sessions: result.parsed, rawText: result.rawText, model: result.model }
}
