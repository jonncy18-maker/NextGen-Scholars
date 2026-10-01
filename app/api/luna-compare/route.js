import { requireMentor } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';
import { tier3Ingest } from '../../../lib/ai/tier3.js';

// TEMPORARY — delete this route, app/luna-compare/ and src/screens/LunaCompare.jsx
// once the expense-ingestion comparison has been judged (ROADMAP.md, "Luna for
// expense ingestion").
//
// Mentor-only and read-only: runs ONE receipt (or typed text) through the real
// expense extractor twice, on Claude (what runs today) and on Luna, and returns
// both sets of lines side by side. Nothing is saved.
export const maxDuration = 60;

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

async function timed(fn) {
  const t0 = Date.now();
  const r = await fn();
  return r.answered
    ? { ok: true, items: r.items, model: r.model, ms: Date.now() - t0 }
    : { ok: false, error: r.error, ms: Date.now() - t0 };
}

export const POST = withErrorHandling(async (request) => {
  await requireMentor(request);

  const { text, file } = await request.json().catch(() => ({}));
  if (!text?.trim() && !file?.base64) {
    return json({ error: 'A receipt file or some text is required.' }, { status: 400 });
  }
  if (file && !ACCEPTED_MIME.includes(file.mime)) {
    return json({ error: `Unsupported file type: ${file.mime}` }, { status: 400 });
  }

  const input = { text: text?.trim() || undefined, file: file || undefined };
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const [claude, luna] = await Promise.all([
    anthropicKey
      ? timed(() => tier3Ingest(input, null, anthropicKey, 'claude'))
      : { ok: false, error: 'ANTHROPIC_API_KEY is not set in this environment.', ms: 0 },
    openaiKey
      ? timed(() => tier3Ingest(input, null, openaiKey, 'luna'))
      : { ok: false, error: 'OPENAI_API_KEY is not set in this environment.', ms: 0 },
  ]);

  return json({ claude, luna });
});
