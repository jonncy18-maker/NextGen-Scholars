import { exchangeAuthorizationCode, OAuthError } from '../../../../lib/oauth.js';
import { json } from '../../../../lib/http.js';

// Token endpoint (RFC 6749 §4.1.3 + PKCE, RFC 7636). Accepts both the
// standard form-encoded body and JSON, since MCP client implementations
// aren't consistent about which they send.
export const dynamic = 'force-dynamic';

async function parseBody(request) {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) return (await request.json().catch(() => null)) || {};
  const text = await request.text();
  return Object.fromEntries(new URLSearchParams(text));
}

export async function POST(request) {
  const body = await parseBody(request);
  if (body.grant_type !== 'authorization_code') {
    return json({ error: 'unsupported_grant_type' }, { status: 400 });
  }

  try {
    const access_token = await exchangeAuthorizationCode({
      code: body.code,
      clientId: body.client_id,
      redirectUri: body.redirect_uri,
      codeVerifier: body.code_verifier,
    });
    return json({ access_token, token_type: 'Bearer' });
  } catch (err) {
    if (err instanceof OAuthError) return json({ error: err.code, error_description: err.message }, { status: err.status });
    console.error('oauth token exchange failed:', err);
    return json({ error: 'server_error' }, { status: 500 });
  }
}
