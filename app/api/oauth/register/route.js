import { registerClient, OAuthError } from '../../../../lib/oauth.js';
import { json } from '../../../../lib/http.js';

// Dynamic client registration (RFC 7591 subset) — open by design, same as
// any public-client OAuth flow. See lib/oauth.js's header for why an
// unauthenticated register endpoint is fine here: the real gate is the
// mentor's own sign-in + consent at /oauth/authorize, not client secrecy.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_client_metadata', error_description: 'Invalid JSON body' }, { status: 400 });

  try {
    const client = await registerClient({ redirect_uris: body.redirect_uris, client_name: body.client_name });
    return json(
      {
        client_id: client.client_id,
        redirect_uris: client.redirect_uris,
        client_name: client.client_name,
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code'],
        response_types: ['code'],
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof OAuthError) return json({ error: err.code, error_description: err.message }, { status: err.status });
    console.error('oauth register failed:', err);
    return json({ error: 'server_error' }, { status: 500 });
  }
}
