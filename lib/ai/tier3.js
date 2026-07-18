// Tier 3 — multimodal ingestion (Gemini 2.5 Flash)
// Extracts structured data from uploaded images or pasted text.
// Returns JSON for human review — does NOT write to the database.
// Handles three extraction types: expense line items, grade entries, and
// English study sessions.

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const EXPENSE_CATS = [
  'Tuition', 'Enrollment', 'Uniforms', 'Books', 'Living Expenses',
  'Printing & Research', 'School Supplies', 'Activities',
  'Medical Equipment', 'Motor', 'Milestones', 'Other',
]

export async function tier3Ingest(
  options,
  _scholar,
  geminiKey,
) {
  const today = new Date().toISOString().slice(0, 10)

  const systemPrompt = `You are an expense extraction assistant for NextGen Scholars, a mentorship program for Filipino nursing students.

Extract ALL expense line items from the provided receipt or document. Return ONLY a JSON array — no prose, no markdown fences, no explanation.

Each object in the array must follow this exact schema:
{
  "item":   string,   // descriptive name of the expense item
  "amount": number,   // unit price in Philippine Peso (PHP) — plain number, no currency symbols
  "qty":    number,   // quantity (default 1 if not specified)
  "cat":    string,   // MUST be one of: ${EXPENSE_CATS.join(', ')}
  "date":   string,   // ISO 8601 YYYY-MM-DD (use document date; if absent use ${today})
  "vendor": string    // vendor or merchant name (empty string "" if not shown)
}

Rules:
- Extract EVERY line item — do not summarise or merge distinct items
- amount is the UNIT price; qty is the count (total = amount × qty)
- For tuition receipts: one object per fee line
- Choose the most specific category; default to "Other" if none fits
- Numbers must be plain numbers — never include commas, peso signs, or quotes
- If the document contains no expense data, return []
- Your entire response must be a valid JSON array starting with [ and ending with ]`

  const parts = []

  if (options.file) {
    parts.push({ inlineData: { mimeType: options.file.mime, data: options.file.base64 } })
  }

  parts.push({
    text: options.text
      ? `Receipt / document text:\n\n${options.text}`
      : 'Extract all expense line items from the image above.',
  })

  let res
  try {
    res = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
      method:  'POST',
      // Bypass Next's Data Cache — a POST fetch from a route handler is cached
      // by url+body otherwise (see CLAUDE.md "Neon driver ... Data Cache").
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature:     0.1,
          thinkingConfig:  { thinkingBudget: 0 },
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
    const cleaned = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    const items = JSON.parse(cleaned)
    if (!Array.isArray(items)) throw new Error('Response is not an array')
    return { answered: true, items, rawText, model: GEMINI_MODEL }
  } catch {
    return {
      answered: false,
      error:    `Could not parse Gemini response as JSON: ${rawText.slice(0, 300)}`,
    }
  }
}

// ── Grade ingestion ───────────────────────────────────────────────────────────

export async function tier3GradeIngest(
  options,
  _scholar,
  geminiKey,
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

  const parts = []

  if (options.file) {
    parts.push({ inlineData: { mimeType: options.file.mime, data: options.file.base64 } })
  }

  parts.push({
    text: options.text
      ? `Grade report / transcript text:\n\n${options.text}`
      : 'Extract all subject grade entries from the image above.',
  })

  let res
  try {
    res = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
      method:  'POST',
      // Bypass Next's Data Cache — a POST fetch from a route handler is cached
      // by url+body otherwise (see CLAUDE.md "Neon driver ... Data Cache").
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature:     0.1,
          thinkingConfig:  { thinkingBudget: 0 },
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
    const cleaned = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    const grades = JSON.parse(cleaned)
    if (!Array.isArray(grades)) throw new Error('Response is not an array')
    return { answered: true, grades, rawText, model: GEMINI_MODEL }
  } catch {
    return { answered: false, error: `Could not parse Gemini response as JSON: ${rawText.slice(0, 300)}` }
  }
}

// ── English session ingestion (Gemini) ────────────────────────────────────────

export async function tier3EnglishIngest(
  text,
  categories,
  geminiKey,
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

  let res
  try {
    res = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
      method:  'POST',
      // Bypass Next's Data Cache — a POST fetch from a route handler is cached
      // by url+body otherwise (see CLAUDE.md "Neon driver ... Data Cache").
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: `English study session summary:\n\n${text}` }] }],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature:     0.1,
          thinkingConfig:  { thinkingBudget: 0 },
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
    const cleaned = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    const sessions = JSON.parse(cleaned)
    if (!Array.isArray(sessions)) throw new Error('Response is not an array')
    return { answered: true, sessions, rawText, model: GEMINI_MODEL }
  } catch {
    return { answered: false, error: `Could not parse Gemini response as JSON: ${rawText.slice(0, 300)}` }
  }
}
