// Action resolver — "record a GCash send" intent.
//
// The model is used ONLY to SELECT which unsent expense rows a free-text send
// description refers to (read-only on the DB). It never writes: the actual
// fee insert + mark-sent happen client-side via supabase-writer.js, so RLS and
// the existing optimistic UI flow stay in charge. This keeps the blast radius
// to "add a fee expense" + "set sent=Yes", both of which the mentor can undo.

import { sql } from '../db.js'

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// GCash cash-out fee: ₱15 per ₱500 block. Mirrors the client (GcashCalculator).
function gcFee(n) { return Math.ceil(n / 500) * 15 }

export async function resolveSendAction(
  scholar,
  text,
  apiKey,
) {
  let rows
  try {
    rows = await sql`select id, item, amount, sem, cat, sent from expenses where scholar = ${scholar} and sent <> 'Yes'`
  } catch (err) {
    return { error: err.message }
  }

  const unsent = (rows ?? []).filter(r => Number(r.amount) > 0)
  if (unsent.length === 0) return { note: 'Nothing unsent on record for this scholar.' }

  const list = unsent.map(r => ({
    id: String(r.id), item: r.item, amount: Number(r.amount), sem: r.sem, cat: r.cat,
  }))

  const prompt = `You map a mentor's free-text description of a money transfer to the specific UNSENT expense line items it pays for.

Unsent items (JSON array):
${JSON.stringify(list)}

The mentor said: "${text}"

Return ONLY a JSON object: {"ids": ["<id>", ...], "note": "<short explanation>"}.
Rules:
- Include an id ONLY if the mentor's description clearly refers to that item (by name, month, category, amount, etc.).
- Match months/terms carefully (e.g. "July transport" → the Transport item dated/labelled July).
- If nothing clearly matches, return {"ids": [], "note": "<why>"}.
- NEVER invent ids. Use only ids that appear in the list above.`

  let res
  try {
    res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 512,
          thinkingConfig: { thinkingBudget: 0 },
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
  if (!out) return { note: 'The AI returned an empty response — try naming the items.' }

  let parsed
  try {
    parsed = JSON.parse(out)
  } catch {
    return { note: 'Could not parse the AI response — try naming the items.' }
  }

  const ids = Array.isArray(parsed.ids) ? parsed.ids.map(String) : []
  const note = typeof parsed.note === 'string' ? parsed.note : undefined
  const matched = unsent.filter(r => ids.includes(String(r.id)))
  if (matched.length === 0) {
    return { note: note || 'No unsent items clearly matched that description.' }
  }

  const subtotal = matched.reduce((s, r) => s + Number(r.amount), 0)
  const fee = gcFee(subtotal)
  return {
    action: 'record_send',
    items:  matched.map(r => ({ id: String(r.id), item: r.item, amount: Number(r.amount), sem: r.sem })),
    fee,
    total:  subtotal + fee,
    note,
    model:  GEMINI_MODEL,
  }
}
