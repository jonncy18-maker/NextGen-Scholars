// GPT-6 Luna — OpenAI's small, high-volume model. Used here only for expense
// ingestion (lib/ai/tier3.js, provider 'luna'), and only where a mentor reviews
// the result before anything is saved. Server-only; the key never reaches the
// browser (AGENTS.md "API Key / Security Rules").
//
// Plain fetch to the Responses API — no SDK. The model ID is an API argument,
// so it stays pinned to an exact ID. `store: false` asks OpenAI not to retain
// the request.

export const LUNA_MODEL = 'gpt-6-luna';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
// Reasoning tokens count against max_output_tokens, so a tight cap can be spent
// entirely on thinking and return nothing. Headroom is added to the caller's cap.
const REASONING_HEADROOM = 800;
const TIMEOUT_MS = 40_000;

// file: { mime, base64 } for an image or a PDF, same shape tier3 already uses.
// Returns { ok: true, text } or { ok: false, error } — never throws — so callers
// keep the `{ answered, error }` convention the Claude and Gemini paths use.
export async function callLuna({ apiKey, system, userText, file, maxTokens = 2048 }) {
  const content = [];
  if (file) {
    const url = `data:${file.mime};base64,${file.base64}`;
    content.push(
      file.mime === 'application/pdf'
        ? { type: 'input_file', filename: file.name || 'document.pdf', file_data: url }
        : { type: 'input_image', image_url: url }
    );
  }
  content.push({ type: 'input_text', text: userText });

  let res;
  try {
    res = await fetch(OPENAI_URL, {
      method: 'POST',
      // Bypass Next's Data Cache — a POST fetch from a route handler is cached
      // by url+body otherwise (see AGENTS.md "Neon driver ... Data Cache").
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: LUNA_MODEL,
        ...(system ? { instructions: system } : {}),
        input: [{ role: 'user', content }],
        max_output_tokens: maxTokens + REASONING_HEADROOM,
        reasoning: { effort: 'low' },
        store: false,
      }),
    });
  } catch (err) {
    return { ok: false, error: `Luna network error: ${err.message}` };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return {
      ok: false,
      error: `Luna API error ${res.status}: ${body?.error?.message || res.statusText}`,
    };
  }

  const data = await res.json();
  if (data.status === 'incomplete') {
    return {
      ok: false,
      error: `Luna response incomplete (${data.incomplete_details?.reason || 'unknown'})`,
    };
  }
  const text = (data.output || [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text)
    .join('')
    .trim();
  if (!text) return { ok: false, error: 'Luna returned an empty response.' };
  return { ok: true, text };
}
