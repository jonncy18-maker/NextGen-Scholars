import { createMcpHandler } from '../../../../lib/mcp-server.js';
import { MCP_TOOLS, executeMcpTool, ngsMcpInstructions } from '../../../../lib/ai/mcp-tools.js';

// The NGS mentor MCP server — exposes the same tool registry the in-app Tier
// 4 agent uses (lib/ai/tools.js, via app/api/agent) over the Model Context
// Protocol, so both claude.ai/Claude Desktop and ChatGPT's connector can do
// exactly what the mentor console's AI assistant can do, no more. See
// lib/ai/mcp-tools.js's header for why every tool (reads and writes) is
// exposed directly rather than through the in-app plan/confirm split — the
// connecting client's own tool-approval UI is the confirmation step here.
//
// Deliberately mentor-scoped, not per-scholar: this is the operational
// surface (managing every scholar, expenses, grades, deadlines, etc.), the
// same role the mentor's own Navigator session runs as. Gated by a single
// bearer secret (NGS_MCP_TOKEN in Vercel) rather than a real Better Auth
// JWT — same tradeoff the sibling Personal-Dashboard repo made for its own
// MCP servers: one operational credential, not a second account system.
//
// Transport, the bearer-token gate, and the OAuth wrapper for claude.ai's
// connector (lib/mcp-server.js / lib/mcp-oauth.js) are ported verbatim from
// Personal-Dashboard, which proved the approach first.

async function callTool(name, args) {
  return executeMcpTool(name, args);
}

export const POST = createMcpHandler({
  tokenEnvVar: 'NGS_MCP_TOKEN',
  resourcePath: '/api/mcp/ngs',
  serverName: 'nextgen-scholars-mentor',
  tools: MCP_TOOLS,
  callTool,
  instructions: ngsMcpInstructions,
});
