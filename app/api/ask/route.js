import { sql } from '../../../lib/db.js';
import { requireMentor } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';
import { tier1Resolve } from '../../../lib/ai/tier1.js';
import { buildContext } from '../../../lib/ai/context.js';
import { tier2Ask, tier2WeeklyReport } from '../../../lib/ai/tier2.js';
import { tier3Ingest, tier3GradeIngest } from '../../../lib/ai/tier3.js';
import { resolveSendAction } from '../../../lib/ai/action.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// Port of supabase/functions/ask/index.ts — the mentor-facing AI orchestrator
// (NavigatorAI, ExpenseWorkbench/GcashCalculator).
// Routing rules (evaluated in order), unchanged from the original:
//   type=weekly_report           -> Tier 2, whole-cohort context
//   type=action                  -> Tier 2, GCash send-matching (read-only)
//   type=ingest                  -> Tier 3, expense extraction
//   type=grade_ingest            -> Tier 3, grade extraction
//   type=coach                   -> Tier 2, canned coaching prompt
//   type=query                   -> Tier 1, escalates to Tier 2 if unresolved

export const POST = withErrorHandling(async (request) => {
  await requireMentor(request);

  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

  const { scholar, type, text, sem, file } = body;
  if (!scholar && type !== 'weekly_report') return json({ error: 'Missing required field: scholar' }, { status: 400 });
  if (!['query', 'ingest', 'grade_ingest', 'coach', 'action', 'weekly_report'].includes(type)) {
    return json({ error: 'Field "type" must be "query", "ingest", "grade_ingest", "coach", "action", or "weekly_report"' }, { status: 400 });
  }

  if (type === 'weekly_report') {
    const geminiKey = process.env.GOOGLE_AI_KEY;
    if (!geminiKey) return json({ tier: 2, status: 'not_configured', error: 'AI not configured — add GOOGLE_AI_KEY to Vercel env vars.', hint: 'Add GOOGLE_AI_KEY to Vercel env vars.' }, { status: 503 });
    let keys = Array.isArray(body.scholars) ? body.scholars.filter(Boolean) : [];
    if (keys.length === 0) {
      const rows = await sql`select scholar_key from scholars order by scholar_key`;
      keys = rows.map(r => r.scholar_key);
    }
    if (keys.length === 0) return json({ tier: 2, status: 'error', error: 'No scholars found.' }, { status: 502 });
    const contexts = await Promise.all(keys.map(k => buildContext(k)));
    const t2 = await tier2WeeklyReport(contexts, geminiKey);
    if (t2.answered) return json({ tier: 2, type: 'weekly_report', report: t2.answer, model: t2.model });
    return json({ tier: 2, status: 'error', error: t2.error }, { status: 502 });
  }

  if (type === 'action') {
    if (!text) return json({ error: 'Action request requires text' }, { status: 400 });
    const geminiKey = process.env.GOOGLE_AI_KEY;
    if (!geminiKey) return json({ status: 'not_configured', error: 'AI not configured — add GOOGLE_AI_KEY to Vercel env vars.', hint: 'Add GOOGLE_AI_KEY to Vercel env vars.' }, { status: 503 });
    const result = await resolveSendAction(scholar, text, geminiKey);
    return json(result);
  }

  if (type === 'ingest') {
    if (!file && !text) return json({ error: 'Ingest request requires file or text' }, { status: 400 });
    const geminiKey = process.env.GOOGLE_AI_KEY;
    if (!geminiKey) return json({ tier: 3, status: 'not_configured', error: 'AI not configured — add GOOGLE_AI_KEY to Vercel env vars.', hint: 'Add GOOGLE_AI_KEY to Vercel env vars.' }, { status: 503 });
    const t3 = await tier3Ingest({ text, file }, scholar, geminiKey);
    if (t3.answered) return json({ tier: 3, items: t3.items, model: t3.model });
    return json({ tier: 3, status: 'error', error: t3.error }, { status: 502 });
  }

  if (type === 'grade_ingest') {
    if (!file && !text) return json({ error: 'Grade ingest request requires file or text' }, { status: 400 });
    const geminiKey = process.env.GOOGLE_AI_KEY;
    if (!geminiKey) return json({ tier: 3, status: 'not_configured', error: 'AI not configured — add GOOGLE_AI_KEY to Vercel env vars.', hint: 'Add GOOGLE_AI_KEY to Vercel env vars.' }, { status: 503 });
    const t3 = await tier3GradeIngest({ text, file }, scholar, geminiKey);
    if (t3.answered) return json({ tier: 3, grades: t3.grades, model: t3.model });
    return json({ tier: 3, status: 'error', error: t3.error }, { status: 502 });
  }

  if (type === 'coach') {
    const geminiKey = process.env.GOOGLE_AI_KEY;
    if (!geminiKey) return json({ tier: 2, status: 'not_configured', error: 'AI not configured — add GOOGLE_AI_KEY to Vercel env vars.', hint: 'Add GOOGLE_AI_KEY to Vercel env vars.' }, { status: 503 });
    const ctx = await buildContext(scholar);
    const name = ctx.profile?.name ?? scholar;
    const prompt = `Draft a mentor coaching update for ${name}. Write 3–5 concise bullet points covering: (1) current academic standing — GPA vs the minimum floor, (2) total invested vs budget allocation and burn rate, (3) English study progress vs the 200-hour OET target, (4) any open actions or upcoming deadlines that need attention, (5) any active alerts that need attention. Each bullet should be one sentence. Write in plain English, practical and direct, suitable for a mentor check-in message. Use ₱ for peso amounts.`;
    const t2 = await tier2Ask(prompt, ctx, geminiKey);
    if (t2.answered) return json({ tier: 2, type: 'coach', note: t2.answer, model: t2.model });
    return json({ tier: 2, status: 'error', error: t2.error }, { status: 502 });
  }

  // type === 'query'
  if (!text?.trim()) return json({ error: 'Query request requires text' }, { status: 400 });

  const t1 = await tier1Resolve(text, scholar);
  if (t1.answered) return json({ tier: 1, ...t1 });

  const geminiKey = process.env.GOOGLE_AI_KEY;
  if (!geminiKey) return json({ tier: 2, status: 'not_configured', error: 'AI not configured — add GOOGLE_AI_KEY to Vercel env vars.', hint: 'Add GOOGLE_AI_KEY to Vercel env vars.' }, { status: 503 });

  const ctx = await buildContext(scholar);
  const t2 = await tier2Ask(text, ctx, geminiKey);
  if (t2.answered) return json({ tier: 2, answer: t2.answer, model: t2.model });
  return json({ tier: 2, status: 'error', error: t2.error }, { status: 502 });
});
