// Tier 3 — multimodal ingestion (Gemini 2.5 Flash or Claude Haiku/Sonnet)
// Extracts structured data from uploaded images or pasted text.
// Returns JSON for human review — does NOT write to the database.
// Handles two extraction types: expense line items and grade entries.
//
// Claude model routing: defaults to Haiku 4.5 (low cost). If the result
// fails confidence scoring, it automatically escalates to Sonnet 4.6.

const GEMINI_MODEL        = 'gemini-2.5-flash'
const GEMINI_URL          = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const CLAUDE_HAIKU_MODEL  = 'claude-haiku-4-5-20251001'
const CLAUDE_SONNET_MODEL = 'claude-sonnet-4-6'
const CLAUDE_URL          = 'https://api.anthropic.com/v1/messages'

export interface ExtractedExpense {
  item:   string
  amount: number
  qty:    number
  cat:    string
  date:   string
  vendor: string
}

export interface Tier3Result {
  answered:   boolean
  items?:     ExtractedExpense[]
  rawText?:   string
  error?:     string
  model?:     string
  escalated?: boolean
}

const EXPENSE_CATS = [
  'Tuition', 'Enrollment', 'Uniforms', 'Books', 'Living Expenses',
  'Printing & Research', 'School Supplies', 'Activities',
  'Medical Equipment', 'Motor', 'Milestones', 'Other',
]

export async function tier3Ingest(
  options: { text?: string; file?: { base64: string; mime: string } },
  _scholar: string,
  geminiKey: string,
): Promise<Tier3Result> {
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

  const parts: unknown[] = []

  if (options.file) {
    parts.push({ inlineData: { mimeType: options.file.mime, data: options.file.base64 } })
  }

  parts.push({
    text: options.text
      ? `Receipt / document text:\n\n${options.text}`
      : 'Extract all expense line items from the image above.',
  })

  let res: Response
  try {
    res = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
      method:  'POST',
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
    return { answered: false, error: `Network error calling Gemini: ${(err as Error).message}` }
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

  const data = await res.json()
  const rawText = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '') as string

  if (!rawText.trim()) return { answered: false, error: 'Gemini returned an empty response.' }

  try {
    const cleaned = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    const items: ExtractedExpense[] = JSON.parse(cleaned)
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

export interface ExtractedGrade {
  subject:     string
  units:       number
  school:      'uv' | 'k12'
  prelim:      number | null
  midterm:     number | null
  final_grade: number | null
}

export interface Tier3GradeResult {
  answered:   boolean
  grades?:    ExtractedGrade[]
  rawText?:   string
  error?:     string
  model?:     string
  escalated?: boolean
}

export async function tier3GradeIngest(
  options: { text?: string; file?: { base64: string; mime: string } },
  _scholar: string,
  geminiKey: string,
): Promise<Tier3GradeResult> {
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
- units must be a positive number; use 3 if not shown
- school: detect from the grade scale used; default "uv" if unclear
- Extract every subject row — do not skip any
- If the document contains no grade data, return []
- Your entire response must be a valid JSON array starting with [ and ending with ]`

  const parts: unknown[] = []

  if (options.file) {
    parts.push({ inlineData: { mimeType: options.file.mime, data: options.file.base64 } })
  }

  parts.push({
    text: options.text
      ? `Grade report / transcript text:\n\n${options.text}`
      : 'Extract all subject grade entries from the image above.',
  })

  let res: Response
  try {
    res = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
      method:  'POST',
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
    return { answered: false, error: `Network error calling Gemini: ${(err as Error).message}` }
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

  const data = await res.json()
  const rawText = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '') as string

  if (!rawText.trim()) return { answered: false, error: 'Gemini returned an empty response.' }

  try {
    const cleaned = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    const grades: ExtractedGrade[] = JSON.parse(cleaned)
    if (!Array.isArray(grades)) throw new Error('Response is not an array')
    return { answered: true, grades, rawText, model: GEMINI_MODEL }
  } catch {
    return { answered: false, error: `Could not parse Gemini response as JSON: ${rawText.slice(0, 300)}` }
  }
}

// ── Claude variants ───────────────────────────────────────────────────────────

// Low-confidence signals for expenses — triggers escalation from Haiku → Sonnet.
// An empty result, heavy "Other" categorisation, or zero-amount items indicate
// the smaller model struggled to parse the document.
function isExpenseConfident(items: ExtractedExpense[]): boolean {
  if (items.length === 0) return false
  const otherRatio = items.filter(i => i.cat === 'Other').length / items.length
  if (otherRatio > 0.5) return false
  if (items.some(i => i.amount === 0)) return false
  return true
}

// Low-confidence signals for grades — triggers escalation from Haiku → Sonnet.
// An empty result or a majority of rows with all periods null suggests the model
// couldn't read the grade scale or table layout reliably.
function isGradeConfident(grades: ExtractedGrade[]): boolean {
  if (grades.length === 0) return false
  const allNullRatio = grades.filter(
    g => g.prelim === null && g.midterm === null && g.final_grade === null,
  ).length / grades.length
  if (allNullRatio > 0.5) return false
  return true
}

function buildClaudeContent(
  options: { text?: string; file?: { base64: string; mime: string } },
  fallbackText: string,
): unknown[] {
  const parts: unknown[] = []
  if (options.file) {
    if (options.file.mime === 'application/pdf') {
      parts.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: options.file.base64 } })
    } else {
      parts.push({ type: 'image', source: { type: 'base64', media_type: options.file.mime, data: options.file.base64 } })
    }
  }
  parts.push({ type: 'text', text: options.text ? `Receipt / document text:\n\n${options.text}` : fallbackText })
  return parts
}

async function callClaude(
  system: string,
  content: unknown[],
  anthropicKey: string,
  model = CLAUDE_HAIKU_MODEL,
): Promise<{ text: string; error?: string }> {
  let res: Response
  try {
    res = await fetch(CLAUDE_URL, {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content }],
      }),
    })
  } catch (err) {
    return { text: '', error: `Network error calling Claude: ${(err as Error).message}` }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let message = `Claude API error ${res.status}`
    try {
      const parsed = JSON.parse(body)
      if (parsed?.error?.message) message = parsed.error.message
    } catch { /* leave default */ }
    return { text: '', error: message }
  }
  const data = await res.json()
  const text = (data?.content?.[0]?.text ?? '') as string
  return { text }
}

export async function tier3IngestClaude(
  options: { text?: string; file?: { base64: string; mime: string } },
  _scholar: string,
  anthropicKey: string,
): Promise<Tier3Result> {
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

  const content = buildClaudeContent(options, 'Extract all expense line items from the image above.')

  // ── Haiku first pass ──────────────────────────────────────────────────────
  const { text: haikuText, error: haikuErr } = await callClaude(systemPrompt, content, anthropicKey, CLAUDE_HAIKU_MODEL)
  if (haikuErr) return { answered: false, error: haikuErr }
  if (!haikuText.trim()) return { answered: false, error: 'Claude returned an empty response.' }

  let haikuItems: ExtractedExpense[] | null = null
  try {
    const cleaned = haikuText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) haikuItems = parsed
  } catch { /* parse failure → escalate */ }

  if (haikuItems !== null && isExpenseConfident(haikuItems)) {
    return { answered: true, items: haikuItems, rawText: haikuText, model: CLAUDE_HAIKU_MODEL, escalated: false }
  }

  // ── Sonnet escalation ─────────────────────────────────────────────────────
  const { text: sonnetText, error: sonnetErr } = await callClaude(systemPrompt, content, anthropicKey, CLAUDE_SONNET_MODEL)
  if (sonnetErr) return { answered: false, error: sonnetErr }
  if (!sonnetText.trim()) return { answered: false, error: 'Claude Sonnet returned an empty response.' }
  try {
    const cleaned = sonnetText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    const items: ExtractedExpense[] = JSON.parse(cleaned)
    if (!Array.isArray(items)) throw new Error('Response is not an array')
    return { answered: true, items, rawText: sonnetText, model: CLAUDE_SONNET_MODEL, escalated: true }
  } catch {
    return { answered: false, error: `Could not parse Claude response as JSON: ${sonnetText.slice(0, 300)}` }
  }
}

// ── English session ingestion (Claude only) ───────────────────────────────────

export interface ExtractedEnglishSession {
  date:             string
  duration_minutes: number
  category:         string
  notes:            string
}

export interface Tier3EnglishResult {
  answered:   boolean
  sessions?:  ExtractedEnglishSession[]
  rawText?:   string
  error?:     string
  model?:     string
  escalated?: boolean
}

function isEnglishConfident(sessions: ExtractedEnglishSession[]): boolean {
  if (sessions.length === 0) return false
  if (sessions.some(s => !s.duration_minutes || s.duration_minutes <= 0)) return false
  return true
}

export async function tier3EnglishIngestClaude(
  text: string,
  categories: string[],
  anthropicKey: string,
): Promise<Tier3EnglishResult> {
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

  const content = [{ type: 'text', text: `English study session summary:\n\n${text}` }]

  // Haiku first pass
  const { text: haikuText, error: haikuErr } = await callClaude(systemPrompt, content, anthropicKey, CLAUDE_HAIKU_MODEL)
  if (haikuErr) return { answered: false, error: haikuErr }
  if (!haikuText.trim()) return { answered: false, error: 'Claude returned an empty response.' }

  let haikuSessions: ExtractedEnglishSession[] | null = null
  try {
    const cleaned = haikuText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) haikuSessions = parsed
  } catch { /* parse failure → escalate */ }

  if (haikuSessions !== null && isEnglishConfident(haikuSessions)) {
    return { answered: true, sessions: haikuSessions, rawText: haikuText, model: CLAUDE_HAIKU_MODEL, escalated: false }
  }

  // Sonnet escalation
  const { text: sonnetText, error: sonnetErr } = await callClaude(systemPrompt, content, anthropicKey, CLAUDE_SONNET_MODEL)
  if (sonnetErr) return { answered: false, error: sonnetErr }
  if (!sonnetText.trim()) return { answered: false, error: 'Claude Sonnet returned an empty response.' }
  try {
    const cleaned = sonnetText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    const sessions: ExtractedEnglishSession[] = JSON.parse(cleaned)
    if (!Array.isArray(sessions)) throw new Error('Response is not an array')
    return { answered: true, sessions, rawText: sonnetText, model: CLAUDE_SONNET_MODEL, escalated: true }
  } catch {
    return { answered: false, error: `Could not parse Claude response as JSON: ${sonnetText.slice(0, 300)}` }
  }
}

export async function tier3GradeIngestClaude(
  options: { text?: string; file?: { base64: string; mime: string } },
  _scholar: string,
  anthropicKey: string,
): Promise<Tier3GradeResult> {
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
- units must be a positive number; use 3 if not shown
- school: detect from the grade scale used; default "uv" if unclear
- Extract every subject row — do not skip any
- If the document contains no grade data, return []
- Your entire response must be a valid JSON array starting with [ and ending with ]`

  const content = buildClaudeContent(options, 'Extract all subject grade entries from the image above.')

  // ── Haiku first pass ──────────────────────────────────────────────────────
  const { text: haikuText, error: haikuErr } = await callClaude(systemPrompt, content, anthropicKey, CLAUDE_HAIKU_MODEL)
  if (haikuErr) return { answered: false, error: haikuErr }
  if (!haikuText.trim()) return { answered: false, error: 'Claude returned an empty response.' }

  let haikuGrades: ExtractedGrade[] | null = null
  try {
    const cleaned = haikuText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) haikuGrades = parsed
  } catch { /* parse failure → escalate */ }

  if (haikuGrades !== null && isGradeConfident(haikuGrades)) {
    return { answered: true, grades: haikuGrades, rawText: haikuText, model: CLAUDE_HAIKU_MODEL, escalated: false }
  }

  // ── Sonnet escalation ─────────────────────────────────────────────────────
  const { text: sonnetText, error: sonnetErr } = await callClaude(systemPrompt, content, anthropicKey, CLAUDE_SONNET_MODEL)
  if (sonnetErr) return { answered: false, error: sonnetErr }
  if (!sonnetText.trim()) return { answered: false, error: 'Claude Sonnet returned an empty response.' }
  try {
    const cleaned = sonnetText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    const grades: ExtractedGrade[] = JSON.parse(cleaned)
    if (!Array.isArray(grades)) throw new Error('Response is not an array')
    return { answered: true, grades, rawText: sonnetText, model: CLAUDE_SONNET_MODEL, escalated: true }
  } catch {
    return { answered: false, error: `Could not parse Claude response as JSON: ${sonnetText.slice(0, 300)}` }
  }
}
