// Deployment-aware base URL for the OAuth/MCP discovery surface
// (app/.well-known/oauth-*/route.js, app/api/mcp/route.js). Vercel sets
// VERCEL_ENV ('production' | 'preview' | 'development') and VERCEL_URL (the
// current deployment's own host, no protocol) on every build; production
// additionally gets VERCEL_PROJECT_PRODUCTION_URL, the canonical domain,
// which is what we want production to advertise instead of whichever
// Vercel-generated alias served this particular request.
//
// Without this, a preview deployment's OAuth metadata pointed claude.ai at
// the production domain (which doesn't carry the PR's OAuth routes),
// breaking discovery/registration/authorization from any preview.
export function getAppUrl() {
  if (process.env.VERCEL_ENV === 'production') {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || 'next-gen-scholars-jonncy18.vercel.app'}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'https://next-gen-scholars-jonncy18.vercel.app';
}
