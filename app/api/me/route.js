import { requireScholarOwn } from '../../../lib/auth.js';
import { json, withErrorHandling } from '../../../lib/http.js';

// Identity check for scholar-facing sign-in gates: verifies the bearer token
// and returns the role/scholar_key resolved server-side from user_profile —
// the client never decides its own scholar_key.
export const GET = withErrorHandling(async (request) => {
  const { role, scholarKey } = await requireScholarOwn(request);
  return json({ role, scholarKey });
});
