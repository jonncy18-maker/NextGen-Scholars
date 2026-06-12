// Tier 3 — Gemini 2.5 Flash (multimodal ingestion)
// Extracts structured data from uploaded images or pasted text.
// Returns JSON for human review — does NOT write to the database.
// Handles two extraction types: expense line items (tier3Ingest) and grade entries (tier3GradeIngest).
//
// Uses Gemini 2.5 Flash (free tier) instead of Claude for cost efficiency.
// thinkingBudget: 0 disables chain-of-thought to keep latency low for extraction tasks.

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

export interface ExtractedExpense {
  item:   string
  amount: number
  qty:    number
  cat:    string
  date:   string
  vendor: string
}

export interface Tier3Result {
  answered: boolean
  items?:   ExtractedExpense[]
  rawText?: string
  error?:   string
  model?:   string
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
  answered: boolean
  grades?:  ExtractedGrade[]
  rawText?: string
  error?:   string
  model?:   string
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
