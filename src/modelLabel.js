// Display name for the model that answered, derived from the `model` field the
// API returns, so a badge never says "Claude" for an answer Luna or Gemini gave.
// `fallback` is what to show when the response carried no model (an error, or an
// older response shape).
export function modelLabel(model, fallback = 'AI') {
  const m = String(model || '').toLowerCase();
  if (m.startsWith('claude')) return 'Claude';
  if (m.includes('luna')) return 'Luna';
  if (m.startsWith('gemini')) return 'Gemini';
  return fallback;
}

// /api/ask-scholar is the public, unauthenticated route and is Gemini-only by
// design (CLAUDE.md "Provider routing"). Text shown while a request to it is
// still in flight uses this, because the answering model isn't known until the
// response arrives. Keep it in step with that route.
export const ASK_SCHOLAR_LABEL = 'Gemini';
