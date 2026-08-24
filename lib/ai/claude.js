// Claude — the AI brain for signed-in mentor and scholar accounts.
//
// Both roles now share one universal AI surface (Tier 4's tool-based agent,
// plus the mentor's Tier 2 advisory/coaching/ingest and the scholar's living
// budget assistant), so all of it is routed through Claude Sonnet rather than
// Gemini. The two unauthenticated, public-facing routes — app/api/ask-public
// (homepage widget) and app/api/ask-scholar (unauthenticated scholar
// fallback) — stay on Gemini; ANTHROPIC_API_KEY is never read from there.
//
// One Anthropic client per call, constructed with the caller's own apiKey
// (never a module-scope singleton) — matching the fetch-per-call pattern the
// Gemini call sites already use, and avoiding any build-time dependency on
// ANTHROPIC_API_KEY being set (Next's "Collecting page data" step evaluates
// route modules; see lib/db.js's identical rationale for lazy construction).

import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_MODEL = 'claude-sonnet-5';

// Thin wrapper around messages.create with the same error-shape convention
// every Gemini call site already used (`{ ok, ...}` / a `message` string),
// so callers can keep their existing parsing logic.
export async function callClaude({ apiKey, system, messages, tools, maxTokens = 2048, temperature = 0.3 }) {
  const client = new Anthropic({ apiKey });
  try {
    const res = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      temperature,
      ...(system ? { system } : {}),
      ...(tools ? { tools } : {}),
      messages,
    });
    return { ok: true, message: res };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, error: `Claude quota exceeded — ${err.message}` };
    }
    if (err instanceof Anthropic.APIError) {
      return { ok: false, error: `Claude API error ${err.status}: ${err.message}` };
    }
    return { ok: false, error: `Claude network error: ${err.message}` };
  }
}

// Concatenate every text block in a response — tool-use turns can carry a
// short lead-in sentence alongside the tool_use block(s).
export function textFromMessage(message) {
  return (message?.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

// The tool registry (lib/ai/tools.js) declares parameters in Gemini's
// OpenAPI-subset shape (uppercase type names: STRING/NUMBER/BOOLEAN/OBJECT) —
// Claude's tool `input_schema` is plain JSON Schema (lowercase types). Rather
// than carry two parallel schemas in the registry, convert at the call site.
export function toJsonSchema(param) {
  if (!param || typeof param !== 'object') return param;
  const { type, properties, required, description, ...rest } = param;
  const out = { ...rest };
  if (type) out.type = String(type).toLowerCase();
  if (description) out.description = description;
  if (properties) {
    out.properties = Object.fromEntries(
      Object.entries(properties).map(([k, v]) => [k, toJsonSchema(v)])
    );
  }
  if (required) out.required = required;
  return out;
}
