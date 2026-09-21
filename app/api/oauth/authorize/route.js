import { requireMentor } from '../../../../lib/auth.js';
import { createAuthorizationCode, OAuthError } from '../../../../lib/oauth.js';
import { json, withErrorHandling } from '../../../../lib/http.js';

// Mints an authorization code once a signed-in mentor has consented at
// app/oauth/authorize/page.jsx. requireMentor means a scholar session (or no
// session) gets a 401/403 here — only the mentor account can grant MCP
// access, matching mcp_api_keys being mentor-scope-only.
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request) => {
  const { userId } = await requireMentor(request);
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_request' }, { status: 400 });

  const { client_id, redirect_uri, code_challenge, code_challenge_method, state } = body;
  try {
    const code = await createAuthorizationCode({
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      userId,
    });
    const url = new URL(redirect_uri);
    url.searchParams.set('code', code);
    if (state) url.searchParams.set('state', state);
    return json({ redirect: url.toString() });
  } catch (err) {
    if (err instanceof OAuthError) return json({ error: err.code, error_description: err.message }, { status: err.status });
    throw err;
  }
});
