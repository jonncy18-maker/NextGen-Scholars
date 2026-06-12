// Tier 3 — Claude claude-sonnet-4-6 (multimodal ingestion)
// Extracts structured data from uploaded images or pasted text.
// Returns JSON for human review — does NOT write to the database.
// Handles two extraction types: expense line items (tier3Ingest) and grade entries (tier3GradeIngest).

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

  // Build message content
  const content: unknown[] = []

  if (options.file) {
    content.push({
      type: 'image',
      source: {
        type:       'base64',
        media_type: options.file.mime,
        data:       options.file.base64,
      },
    })
  }

  const userText = options.text
    ? `Receipt / document text:\n\n${options.text}`
    : 'Extract all expense line items from the image above.'

  content.push({ type: 'text', text: userText })

  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'x-api-key':         anthropicKey,
        'Content-Type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 4096,
        system:     systemPrompt,
        messages:   [{ role: 'user', content }],
      }),
    })
  } catch (fetchErr) {
    return { answered: false, error: `Network error calling Claude: ${(fetchErr as Error).message}` }
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    return { answered: false, error: `Claude API error ${res.status}: ${errText}` }
  }

  const data = await res.json()

  // Find the text content block — thinking blocks have type 'thinking'
  const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text')
  if (!textBlock) {
    return { answered: false, error: 'Claude returned no text content.' }
  }

  const rawText: string = (textBlock.text ?? '').trim()

  try {
    // Strip any accidental markdown fences
    const cleaned = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    const items: ExtractedExpense[] = JSON.parse(cleaned)
    if (!Array.isArray(items)) throw new Error('Response is not an array')
    return { answered: true, items, rawText, model: data.model }
  } catch {
    return {
      answered: false,
      error:    `Could not parse Claude response as JSON: ${rawText.slice(0, 300)}`,
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

  const content: unknown[] = []

  if (options.file) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: options.file.mime, data: options.file.base64 },
    })
  }

  const userText = options.text
    ? `Grade report / transcript text:\n\n${options.text}`
    : 'Extract all subject grade entries from the image above.'

  content.push({ type: 'text', text: userText })

  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'x-api-key':         anthropicKey,
        'Content-Type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 4096,
        system:     systemPrompt,
        messages:   [{ role: 'user', content }],
      }),
    })
  } catch (fetchErr) {
    return { answered: false, error: `Network error calling Claude: ${(fetchErr as Error).message}` }
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    return { answered: false, error: `Claude API error ${res.status}: ${errText}` }
  }

  const data = await res.json()
  const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text')
  if (!textBlock) return { answered: false, error: 'Claude returned no text content.' }

  const rawText: string = (textBlock.text ?? '').trim()

  try {
    const cleaned = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    const grades: ExtractedGrade[] = JSON.parse(cleaned)
    if (!Array.isArray(grades)) throw new Error('Response is not an array')
    return { answered: true, grades, rawText, model: data.model }
  } catch {
    return { answered: false, error: `Could not parse Claude response as JSON: ${rawText.slice(0, 300)}` }
  }
}
