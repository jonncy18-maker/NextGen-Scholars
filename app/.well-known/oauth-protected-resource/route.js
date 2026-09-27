import { createProtectedResourceMetadataHandler } from '../../../lib/mcp-server.js';

// Root-level fallback for an MCP client that checks the origin's well-known
// path without a resource-specific suffix. Points at the ngs MCP server —
// the only MCP resource this app exposes today.
export const GET = createProtectedResourceMetadataHandler('/api/mcp/ngs');
