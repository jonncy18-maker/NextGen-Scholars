import { requireScholarOwn } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';
import { runPlan, runConfirmed } from '../../../lib/ai/agent.js';
import { toolsForRole } from '../../../lib/ai/tools.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// The agent endpoint — the AI's parity path with the manual UI. Runs on
// Claude, the AI brain for signed-in mentor/scholar accounts (see CLAUDE.md
// "AI layer").
//
// Unlike app/api/ask/route.js (mentor-only, fixed `type`s, read-only), this
// route serves both signed-in roles and can change data. Two modes:
//
//   { mode: 'plan',    text, messages? }  → reads freely, returns an answer or
//                                           a set of proposed changes
//   { mode: 'confirm', calls: [...] }     → runs changes the human approved
//
// Both go through requireScholarOwn, so an unauthenticated caller gets 401 —
// this route is deliberately NOT like ask-scholar/ask-public, which are open by
// design and trust a client-supplied scholar key. Here the scholar key comes
// from the verified token's profile row and the tool layer pins every scholar
// -role query to it, so a scholar cannot read or write another scholar's data
// no matter what the model or the client asks for.
//
// GET returns the caller's tool inventory — used by the UI to show what the
// assistant can do for this role.

export const GET = withErrorHandling(async (request) => {
  const { role } = await requireScholarOwn(request);
  return json({
    role,
    tools: toolsForRole(role).map((t) => ({
      name: t.name,
      description: t.description,
      mutates: t.mutates,
    })),
  });
});

export const POST = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);

  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

  const mode = body.mode || 'plan';

  if (mode === 'confirm') {
    if (!Array.isArray(body.calls) || !body.calls.length) {
      return json({ error: 'confirm requires a non-empty calls array' }, { status: 400 });
    }
    if (body.calls.length > 25) {
      return json({ error: 'Too many changes in one confirmation.' }, { status: 400 });
    }
    const results = await runConfirmed({ calls: body.calls, role, scholarKey });
    const failed = results.filter((r) => !r.ok);
    // 207-style semantics in a 200: per-call ok/error, since a partial batch is
    // a normal outcome (one id went stale between proposal and confirm).
    return json({ mode: 'confirm', results, ok: failed.length === 0 });
  }

  if (mode !== 'plan') return json({ error: 'mode must be "plan" or "confirm"' }, { status: 400 });

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return json({ error: 'text is required' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(
      { status: 'not_configured', error: 'AI not configured — add ANTHROPIC_API_KEY to Vercel env vars.' },
      { status: 503 }
    );
  }

  // Trim history to the last few turns — enough for follow-ups ("delete that
  // one too") without resending an unbounded transcript on every request.
  const history = Array.isArray(body.messages)
    ? body.messages.filter((m) => m && typeof m.text === 'string' && m.text.trim()).slice(-10)
    : [];

  const result = await runPlan({ text, history, role, scholarKey, apiKey });
  if (result.status === 'error') return json(result, { status: 502 });
  return json(result);
});
