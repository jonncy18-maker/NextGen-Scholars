import { requireScholarOwn } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';

// Every response here is scoped per-caller (mentor vs. a specific scholar) — must never be cached by Next.js or the CDN.
export const dynamic = 'force-dynamic';

// Identity check for scholar-facing sign-in gates: verifies the bearer token
// and returns the role/scholar_key resolved server-side from user_profile —
// the client never decides its own scholar_key.
export const GET = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  return json({ role, scholarKey });
});
