import { createAuthorizeHandlers } from '../../../../../lib/mcp-server.js';

export const { GET, POST } = createAuthorizeHandlers({
  tokenEnvVar: 'NGS_MCP_TOKEN',
  title: 'NextGen Scholars',
});
