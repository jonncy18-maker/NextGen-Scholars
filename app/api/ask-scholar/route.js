import { json, withErrorHandling } from '../../../lib/http.js';
import { tier1Resolve } from '../../../lib/ai/tier1.js';
import { buildContext } from '../../../lib/ai/context.js';
import { tier2Ask } from '../../../lib/ai/tier2.js';
import { tier3Ingest, tier3GradeIngest, tier3EnglishIngest } from '../../../lib/ai/tier3.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// Port of supabase/functions/ask-scholar/index.ts — scholar-scoped AI
// endpoint for student-facing pages. Unauthenticated by design (accepted
// risk, see CLAUDE.md "Known issues" -- trusts a client-supplied scholar
// key, same as before this migration). Not gated behind Better Auth because
// scholar accounts/sign-in aren't wired into these pages yet.

const VALID_SCHOLARS = ['claire', 'april'];

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function geminiJson(prompt, apiKey, opts = {}) {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: opts.maxOutputTokens ?? 2048, temperature: opts.temperature ?? 0.1, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  const gJson = await res.json();
  return gJson?.candidates?.[0]?.content?.parts?.[0]?.text;
}

export const POST = withErrorHandling(async (request) => {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

  const { scholar, type = 'query', text, sem, file, messages, grades, items, categories } = body;

  if (!scholar || !VALID_SCHOLARS.includes(scholar)) {
    return json({ error: 'Invalid or missing scholar key' }, { status: 400 });
  }

  if (type === 'ingest') {
    if (!file && !text) return json({ error: 'Ingest requires file or text' }, { status: 400 });
    const apiKey = process.env.GOOGLE_AI_KEY;
    if (!apiKey) return json({ tier: 3, status: 'not_configured' }, { status: 503 });
    const t3 = await tier3Ingest({ text, file }, scholar, apiKey);
    if (t3.answered) return json({ tier: 3, items: t3.items, model: t3.model });
    return json({ tier: 3, status: 'error', error: t3.error }, { status: 502 });
  }

  if (type === 'english_ingest') {
    if (!text?.trim()) return json({ error: 'english_ingest requires text' }, { status: 400 });
    const cats = Array.isArray(categories) && categories.length
      ? categories
      : ['Free Conversation', 'Travel', 'Visa Interview', 'Medical English'];
    const apiKey = process.env.GOOGLE_AI_KEY;
    if (!apiKey) return json({ tier: 3, status: 'not_configured' }, { status: 503 });
    const t3 = await tier3EnglishIngest(text, cats, apiKey);
    if (t3.answered) return json({ tier: 3, sessions: t3.sessions, model: t3.model });
    return json({ tier: 3, status: 'error', error: t3.error }, { status: 502 });
  }

  if (type === 'grade_ingest') {
    if (!file && !text) return json({ error: 'Grade ingest requires file or text' }, { status: 400 });
    const apiKey = process.env.GOOGLE_AI_KEY;
    if (!apiKey) return json({ tier: 3, status: 'not_configured' }, { status: 503 });
    const t3 = await tier3GradeIngest({ text, file }, scholar, apiKey);
    if (t3.answered) return json({ tier: 3, grades: t3.grades, model: t3.model });
    return json({ tier: 3, status: 'error', error: t3.error }, { status: 502 });
  }

  if (type === 'grade_edit') {
    if (!text?.trim()) return json({ error: 'grade_edit requires instruction text' }, { status: 400 });
    if (!Array.isArray(grades)) return json({ error: 'grade_edit requires grades array' }, { status: 400 });
    const apiKey = process.env.GOOGLE_AI_KEY;
    if (!apiKey) return json({ error: 'AI not configured' }, { status: 503 });

    const prompt = `You are correcting AI-extracted grade entries before a student saves them.\n\nCurrent grades JSON:\n${JSON.stringify(grades, null, 2)}\n\nInstruction: ${text}\n\nReturn ONLY the corrected JSON array with the same structure (fields: subject, units, school, prelim, midterm, final_grade). No explanation, no markdown fences — raw JSON array only.`;
    const raw = await geminiJson(prompt, apiKey);
    if (!raw) return json({ error: 'AI returned no response' }, { status: 502 });
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return json({ error: 'Could not parse corrected grades from AI response' }, { status: 502 });
    const corrected = JSON.parse(match[0]);
    return json({ grades: corrected });
  }

  if (type === 'expense_edit') {
    if (!text?.trim()) return json({ error: 'expense_edit requires instruction text' }, { status: 400 });
    if (!Array.isArray(items)) return json({ error: 'expense_edit requires items array' }, { status: 400 });
    const apiKey = process.env.GOOGLE_AI_KEY;
    if (!apiKey) return json({ error: 'AI not configured' }, { status: 503 });

    const prompt = `You are correcting AI-extracted expense items before the user saves them.\n\nCurrent items JSON:\n${JSON.stringify(items, null, 2)}\n\nInstruction: ${text}\n\nReturn ONLY the corrected JSON array with the same structure (fields: item, amount, qty, cat, date, vendor). No explanation, no markdown fences — raw JSON array only.`;
    const raw = await geminiJson(prompt, apiKey);
    if (!raw) return json({ error: 'AI returned no response' }, { status: 502 });
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return json({ error: 'Could not parse corrected items from AI response' }, { status: 502 });
    const corrected = JSON.parse(match[0]);
    return json({ items: corrected });
  }

  if (type === 'grade_analysis') {
    if (!Array.isArray(grades) || grades.length === 0) return json({ error: 'grade_analysis requires non-empty grades array' }, { status: 400 });
    const apiKey = process.env.GOOGLE_AI_KEY;
    if (!apiKey) return json({ error: 'AI not configured' }, { status: 503 });

    const gradeList = grades.map(g => {
      const prelim = g.prelim != null ? parseFloat(g.prelim) : null;
      const midterm = g.midterm != null ? parseFloat(g.midterm) : null;
      const finalGrade = g.final_grade != null ? parseFloat(g.final_grade) : null;
      const vals = [prelim, midterm, finalGrade].filter(v => v != null && !isNaN(v));
      const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      return { subject: g.subject, units: g.units, school: g.school, prelim, midterm, final: finalGrade, avg };
    });

    const totalUnits = gradeList.reduce((s, g) => s + (parseFloat(g.units) || 0), 0);
    const validForWA = gradeList.filter(g => g.avg != null && g.units);
    const weightedAvg = validForWA.length && totalUnits
      ? validForWA.reduce((s, g) => s + g.avg * (parseFloat(g.units) || 0), 0) / totalUnits
      : null;

    const isUV = gradeList.some(g => g.school === 'uv');
    const scaleNote = isUV ? '(UV scale: 1.0 = highest, 5.0 = failing)' : '(K-12 percentage scale: 100% = highest)';

    const prompt = `You are an academic advisor for NextGen Scholars, a program supporting Filipino nursing students on a pathway to international licensure.

Scholar: ${scholar}${sem ? `, Semester: ${sem}` : ''}
Grade scale: ${scaleNote}

Subjects uploaded:
${gradeList.map(g => `- ${g.subject} (${g.units} units): Prelim=${g.prelim ?? '—'}, Mid=${g.midterm ?? '—'}, Final=${g.final ?? '—'}, Period Avg=${g.avg != null ? g.avg.toFixed(2) : '—'}`).join('\n')}
${weightedAvg != null ? `\nWeighted Average: ${weightedAvg.toFixed(2)}` : ''}

Write a concise 2–3 sentence academic analysis. Cover: overall performance level, any subjects that stand out (strong or at-risk), and a brief encouraging observation. Be specific to these grades. Professional and warm tone. Plain text only — no markdown, no bullet points, no headers.`;

    const analysis = await geminiJson(prompt, apiKey, { maxOutputTokens: 512, temperature: 0.7 });
    if (!analysis) return json({ error: 'AI returned no response' }, { status: 502 });
    return json({ analysis: analysis.trim() });
  }

  // Query — Tier 1 (deterministic DB) then Tier 2 (Gemini advisory)
  if (!text?.trim()) return json({ error: 'Query requires text' }, { status: 400 });

  // Privacy guard: decline any query that mentions another scholar by name
  const otherScholars = VALID_SCHOLARS.filter(s => s !== scholar);
  const lowerText = text.toLowerCase();
  if (otherScholars.some(name => lowerText.includes(name))) {
    return json({
      tier: 1,
      answered: true,
      intent: 'privacy_guard',
      answer: `For privacy reasons, I can only share information about your own progress — not other scholars'. If you have questions about the program overall, try the Ask AI on the homepage.`,
    });
  }

  const t1 = await tier1Resolve(text, scholar);
  if (t1.answered) return json({ tier: 1, ...t1 });

  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey) return json({ tier: 2, status: 'not_configured' }, { status: 503 });

  const ctx = await buildContext(scholar);
  const history = (messages || [])
    .filter(m => m.role === 'user' || m.role === 'model')
    .map(m => ({ role: m.role, text: m.text }));
  const t2 = await tier2Ask(text, ctx, apiKey, history.length ? history : undefined);

  if (t2.answered) return json({ tier: 2, answer: t2.answer, model: t2.model });
  return json({ tier: 2, status: 'error', error: t2.error }, { status: 502 });
});
