import { createAuthorizationServerMetadataHandler } from '../../../lib/mcp-server.js';

// Root-level fallback — see the sibling oauth-protected-resource/route.js
// comment for why this points at the ngs MCP server (the only one this app
// exposes today).
export const GET = createAuthorizationServerMetadataHandler('/api/mcp/ngs');
