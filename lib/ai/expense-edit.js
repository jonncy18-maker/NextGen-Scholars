// Bulk expense-edit resolver — turns a mentor's free-text instruction into
// corrected values for a set of ALREADY-SAVED expense rows.
//
// Read-only on the DB: this only asks Gemini to rewrite the provided rows. The
// caller diffs the result against the originals and applies the changes via the
// existing updateExpense/deleteExpense write path, so the blast radius stays
// "edit/delete rows the mentor was already looking at" and every change is shown
// for confirmation first. Ids are preserved end-to-end; a row the model omits is
// treated by the caller as a delete.

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const EXPENSE_CATS = [
  'Tuition', 'Enrollment', 'Uniforms', 'Books', 'Living Expenses',
  'Printing & Research', 'School Supplies', 'Activities',
  'Medical Equipment', 'Motor', 'Milestones', 'Other',
]

export async function resolveExpenseBulkEdit(rows, text, apiKey) {
  const list = (rows ?? []).map(r => ({
    id:     String(r.id),
    item:   r.item ?? '',
    amount: Number(r.amount) || 0,
    qty:    Number(r.qty) || 1,
    cat:    r.cat ?? 'Other',
    date:   r.date ?? '',
    vendor: r.vendor ?? '',
    sem:    r.sem ?? '',
    status: r.status ?? r.avb ?? 'Actual',
  }))

  if (list.length === 0) return { error: 'No saved expenses to edit for this scholar.' }

  const prompt = `You are correcting a set of ALREADY-SAVED expense rows for a NextGen Scholars mentor. Apply the mentor's instruction to the rows below and return the corrected rows.

Current rows (JSON array):
${JSON.stringify(list, null, 2)}

Mentor's instruction: "${text}"

Return ONLY a JSON array of the rows AFTER applying the instruction. Each object must keep this exact shape:
{
  "id":     string,   // COPY the row's id EXACTLY — never change or invent one
  "item":   string,
  "amount": number,   // unit price in PHP — plain number, no symbols or commas
  "qty":    number,
  "cat":    string,   // MUST be one of: ${EXPENSE_CATS.join(', ')}
  "date":   string,   // ISO 8601 YYYY-MM-DD
  "vendor": string,   // "" if none
  "sem":    string,   // e.g. Y1S1 — leave unchanged unless told otherwise
  "status": string    // "Actual" or "Budget"
}

Rules:
- Preserve every row's "id" character-for-character. Do NOT add rows with new ids.
- Only change the fields the instruction actually asks to change; leave everything else identical to the input.
- Interpret natural-language money ("₱500", "500 pesos", "1.2k" → 1200) as plain numbers.
- "cat" must be exactly one of the allowed categories; pick the closest if the instruction names something else.
- To DELETE a row, OMIT it from the returned array (only do this when the instruction clearly asks to remove/delete it).
- Your entire response must be a valid JSON array starting with [ and ending with ].`

  let res
  try {
    res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      // Bypass Next's Data Cache — a POST fetch from a route handler is cached
      // by url+body otherwise (see CLAUDE.md "Neon driver ... Data Cache").
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:      0,
          maxOutputTokens:  4096,
          thinkingConfig:   { thinkingBudget: 0 },
          responseMimeType: 'application/json',
        },
      }),
    })
  } catch (err) {
    return { error: `Gemini network error: ${err.message}` }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let message = `Gemini API error ${res.status}`
    try {
      const inner = JSON.parse(body)?.error?.message
      if (inner) message = res.status === 429 ? `Gemini quota exceeded — ${inner.split('.')[0]}.` : inner
    } catch { /* keep default */ }
    return { error: message }
  }

  const json = await res.json()
  const out = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!out) return { error: 'The AI returned an empty response — try rephrasing the instruction.' }

  let parsed
  try {
    const cleaned = out.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) throw new Error('not an array')
  } catch {
    return { error: `Could not parse the AI response as JSON: ${String(out).slice(0, 200)}` }
  }

  // Guard: keep only rows whose id exists in the input (never create new saved
  // rows through an edit), and coerce numeric fields.
  const validIds = new Set(list.map(r => r.id))
  const rowsOut = parsed
    .filter(r => r && validIds.has(String(r.id)))
    .map(r => ({
      id:     String(r.id),
      item:   typeof r.item === 'string' ? r.item : '',
      amount: Number(r.amount) || 0,
      qty:    Number(r.qty) || 1,
      cat:    EXPENSE_CATS.includes(r.cat) ? r.cat : 'Other',
      date:   typeof r.date === 'string' ? r.date : '',
      vendor: typeof r.vendor === 'string' ? r.vendor : '',
      sem:    typeof r.sem === 'string' ? r.sem : '',
      status: r.status === 'Budget' ? 'Budget' : 'Actual',
    }))

  return { rows: rowsOut, model: GEMINI_MODEL }
}
