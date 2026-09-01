import { json } from '../../../lib/http.js';
import { getAppUrl } from '../../../lib/app-url.js';

// RFC 9728 protected-resource metadata — this is what an MCP client fetches
// after getting a 401 from /api/mcp with a WWW-Authenticate header pointing
// here, to discover which authorization server can mint it a token.
export const dynamic = 'force-dynamic';

export async function GET() {
  const APP_URL = getAppUrl();
  return json({
    resource: `${APP_URL}/api/mcp`,
    authorization_servers: [APP_URL],
  });
}
