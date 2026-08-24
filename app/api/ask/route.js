import { sql } from '../../../lib/db.js';
import { requireMentor } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';
import { tier1Resolve } from '../../../lib/ai/tier1.js';
import { buildContext } from '../../../lib/ai/context.js';
import { tier2Ask, tier2WeeklyReport } from '../../../lib/ai/tier2.js';
import { tier3Ingest, tier3GradeIngest } from '../../../lib/ai/tier3.js';
import { resolveSendAction } from '../../../lib/ai/action.js';
import { resolveExpenseBulkEdit } from '../../../lib/ai/expense-edit.js';

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
//
// This route is mentor-only (requireMentor above), so every LLM call here
// runs on Claude — the AI brain for signed-in accounts (see CLAUDE.md "AI
// layer"). Only the public, unauthenticated ask-public/ask-scholar routes
// stay on Gemini.

export const POST = withErrorHandling(async (request) => {
  await requireMentor(request);

  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

  const { scholar, type, text, sem, file } = body;
  if (!scholar && type !== 'weekly_report') return json({ error: 'Missing required field: scholar' }, { status: 400 });
  if (!['query', 'ingest', 'grade_ingest', 'coach', 'action', 'weekly_report', 'expense_bulk_edit'].includes(type)) {
    return json({ error: 'Field "type" must be "query", "ingest", "grade_ingest", "coach", "action", "weekly_report", or "expense_bulk_edit"' }, { status: 400 });
  }

  if (type === 'weekly_report') {
    const claudeKey = process.env.ANTHROPIC_API_KEY;
    if (!claudeKey) return json({ tier: 2, status: 'not_configured', error: 'AI not configured — add ANTHROPIC_API_KEY to Vercel env vars.', hint: 'Add ANTHROPIC_API_KEY to Vercel env vars.' }, { status: 503 });
    let keys = Array.isArray(body.scholars) ? body.scholars.filter(Boolean) : [];
    if (keys.length === 0) {
      const rows = await sql`select scholar_key from scholars order by scholar_key`;
      keys = rows.map(r => r.scholar_key);
    }
    if (keys.length === 0) return json({ tier: 2, status: 'error', error: 'No scholars found.' }, { status: 502 });
    const contexts = await Promise.all(keys.map(k => buildContext(k)));
    const t2 = await tier2WeeklyReport(contexts, claudeKey, 'claude');
    if (t2.answered) return json({ tier: 2, type: 'weekly_report', report: t2.answer, model: t2.model });
    return json({ tier: 2, status: 'error', error: t2.error }, { status: 502 });
  }

  if (type === 'expense_bulk_edit') {
    if (!text?.trim()) return json({ error: 'expense_bulk_edit requires instruction text' }, { status: 400 });
    if (!Array.isArray(body.rows)) return json({ error: 'expense_bulk_edit requires a rows array' }, { status: 400 });
    const claudeKey = process.env.ANTHROPIC_API_KEY;
    if (!claudeKey) return json({ status: 'not_configured', error: 'AI not configured — add ANTHROPIC_API_KEY to Vercel env vars.', hint: 'Add ANTHROPIC_API_KEY to Vercel env vars.' }, { status: 503 });
    const result = await resolveExpenseBulkEdit(body.rows, text, claudeKey);
    if (result.error) return json({ status: 'error', error: result.error }, { status: 502 });
    return json(result);
  }

  if (type === 'action') {
    if (!text) return json({ error: 'Action request requires text' }, { status: 400 });
    const claudeKey = process.env.ANTHROPIC_API_KEY;
    if (!claudeKey) return json({ status: 'not_configured', error: 'AI not configured — add ANTHROPIC_API_KEY to Vercel env vars.', hint: 'Add ANTHROPIC_API_KEY to Vercel env vars.' }, { status: 503 });
    const result = await resolveSendAction(scholar, text, claudeKey);
    return json(result);
  }

  if (type === 'ingest') {
    if (!file && !text) return json({ error: 'Ingest request requires file or text' }, { status: 400 });
    const claudeKey = process.env.ANTHROPIC_API_KEY;
    if (!claudeKey) return json({ tier: 3, status: 'not_configured', error: 'AI not configured — add ANTHROPIC_API_KEY to Vercel env vars.', hint: 'Add ANTHROPIC_API_KEY to Vercel env vars.' }, { status: 503 });
    const t3 = await tier3Ingest({ text, file }, scholar, claudeKey, 'claude');
    if (t3.answered) return json({ tier: 3, items: t3.items, model: t3.model });
    return json({ tier: 3, status: 'error', error: t3.error }, { status: 502 });
  }

  if (type === 'grade_ingest') {
    if (!file && !text) return json({ error: 'Grade ingest request requires file or text' }, { status: 400 });
    const claudeKey = process.env.ANTHROPIC_API_KEY;
    if (!claudeKey) return json({ tier: 3, status: 'not_configured', error: 'AI not configured — add ANTHROPIC_API_KEY to Vercel env vars.', hint: 'Add ANTHROPIC_API_KEY to Vercel env vars.' }, { status: 503 });
    const t3 = await tier3GradeIngest({ text, file }, scholar, claudeKey, 'claude');
    if (t3.answered) return json({ tier: 3, grades: t3.grades, model: t3.model });
    return json({ tier: 3, status: 'error', error: t3.error }, { status: 502 });
  }

  if (type === 'coach') {
    const claudeKey = process.env.ANTHROPIC_API_KEY;
    if (!claudeKey) return json({ tier: 2, status: 'not_configured', error: 'AI not configured — add ANTHROPIC_API_KEY to Vercel env vars.', hint: 'Add ANTHROPIC_API_KEY to Vercel env vars.' }, { status: 503 });
    const ctx = await buildContext(scholar);
    const name = ctx.profile?.name ?? scholar;
    const prompt = `Draft a mentor coaching update for ${name}. Write 3–5 concise bullet points covering: (1) current academic standing — GPA vs the minimum floor, (2) total invested vs budget allocation and burn rate, (3) English study progress vs the 200-hour OET target, (4) any open actions or upcoming deadlines that need attention, (5) any active alerts that need attention. Each bullet should be one sentence. Write in plain English, practical and direct, suitable for a mentor check-in message. Use ₱ for peso amounts.`;
    const t2 = await tier2Ask(prompt, ctx, claudeKey, undefined, 'claude');
    if (t2.answered) return json({ tier: 2, type: 'coach', note: t2.answer, model: t2.model });
    return json({ tier: 2, status: 'error', error: t2.error }, { status: 502 });
  }

  // type === 'query'
  if (!text?.trim()) return json({ error: 'Query request requires text' }, { status: 400 });

  const t1 = await tier1Resolve(text, scholar);
  if (t1.answered) return json({ tier: 1, ...t1 });

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeKey) return json({ tier: 2, status: 'not_configured', error: 'AI not configured — add ANTHROPIC_API_KEY to Vercel env vars.', hint: 'Add ANTHROPIC_API_KEY to Vercel env vars.' }, { status: 503 });

  const ctx = await buildContext(scholar);
  const t2 = await tier2Ask(text, ctx, claudeKey, undefined, 'claude');
  if (t2.answered) return json({ tier: 2, answer: t2.answer, model: t2.model });
  return json({ tier: 2, status: 'error', error: t2.error }, { status: 502 });
});
