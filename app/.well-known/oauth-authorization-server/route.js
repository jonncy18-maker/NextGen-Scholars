import { json } from '../../../lib/http.js';
import { getAppUrl } from '../../../lib/app-url.js';

// RFC 8414 authorization-server metadata — advertises the endpoints backing
// the flow in lib/oauth.js. authorization_endpoint is a real page (renders
// the mentor sign-in + consent UI); token/registration are API routes.
export const dynamic = 'force-dynamic';

export async function GET() {
  const APP_URL = getAppUrl();
  return json({
    issuer: APP_URL,
    authorization_endpoint: `${APP_URL}/oauth/authorize`,
    token_endpoint: `${APP_URL}/api/oauth/token`,
    registration_endpoint: `${APP_URL}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  });
}
