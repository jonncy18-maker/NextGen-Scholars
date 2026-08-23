import { requireMcpKey, McpAuthError } from '../../../lib/mcp-auth.js';
import { toolsForRole, runTool, describeCall } from '../../../lib/ai/tools.js';
import { toJsonSchema } from '../../../lib/mcp/json-schema.js';

// The MCP endpoint — lets an MCP client (Claude Desktop, Claude Code, any
// other MCP host) act with full mentor capability: every tool in
// lib/ai/tools.js, read and write, one-to-one with what the mentor console's
// Tier 4 agent can do (see ROADMAP-AI.md). Auth is a static personal API key
// (lib/mcp-auth.js), not a Better Auth session — see that file's header for
// why.
//
// Deliberate difference from app/api/agent/route.js: that route never
// executes a mutating tool inside the model loop — it stops and returns a
// proposal for a second, human-confirmed request. This endpoint runs
// mutating tools immediately on tools/call. That's intentional, not an
// oversight: the human-in-the-loop here is the MCP *client's own* tool-call
// approval (e.g. Claude Code's permission prompt) rather than the app's UI —
// the write still only happens once a human approves the specific call.
// There is no second "confirm" round trip because the MCP protocol has
// nowhere to put one; don't add one.
//
// Every response is per-caller and must never be cached by Next.js or a CDN.
export const dynamic = 'force-dynamic';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'nextgen-scholars', version: '1.0.0' };
const MAX_RESULT_CHARS = 50000;

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function respond(body, status = 200) {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  });
}

function toolsList(role) {
  return toolsForRole(role).map((t) => ({
    name: t.name,
    description: t.mutates ? `${t.description} (writes data)` : t.description,
    inputSchema: toJsonSchema(t.parameters),
  }));
}

// Caps how much a single tool result can send back to the MCP client — a
// broad list_expenses call shouldn't blow past what the client can hold in
// one turn. Mirrors lib/ai/agent.js's truncate(), same reasoning.
function serializeResult(summary, data) {
  const text = JSON.stringify({ summary, data }, null, 2);
  if (text.length <= MAX_RESULT_CHARS) return text;
  return JSON.stringify(
    {
      summary,
      truncated: true,
      note: `Result too large to return in full (${text.length} chars). Narrow the filters and call again.`,
      preview: Array.isArray(data) ? data.slice(0, 15) : undefined,
    },
    null,
    2
  );
}

async function handleMessage(msg, ctx) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') {
    return rpcError(msg?.id ?? null, -32600, 'Invalid Request');
  }
  const { id, method, params } = msg;
  const isNotification = id === undefined;

  try {
    if (method === 'initialize') {
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    }
    if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
      return null;
    }
    if (method === 'ping') {
      return rpcResult(id, {});
    }
    if (method === 'tools/list') {
      return rpcResult(id, { tools: toolsList(ctx.role) });
    }
    if (method === 'tools/call') {
      const name = params?.name;
      const args = params?.arguments || {};
      try {
        const data = await runTool(name, args, { role: ctx.role, scholarKey: ctx.scholarKey });
        const summary = describeCall(name, args);
        return rpcResult(id, {
          content: [{ type: 'text', text: serializeResult(summary, data) }],
          isError: false,
        });
      } catch (err) {
        return rpcResult(id, {
          content: [{ type: 'text', text: err?.message || 'Tool call failed.' }],
          isError: true,
        });
      }
    }
    if (isNotification) return null;
    return rpcError(id, -32601, `Method not found: ${method}`);
  } catch (err) {
    if (isNotification) return null;
    console.error('mcp handleMessage failed:', err);
    return rpcError(id, -32603, err?.message || 'Internal error');
  }
}

export async function POST(request) {
  let ctx;
  try {
    ctx = await requireMcpKey(request);
  } catch (err) {
    if (err instanceof McpAuthError) {
      return respond(rpcError(null, -32001, err.message), err.status);
    }
    throw err;
  }

  const body = await request.json().catch(() => null);
  if (body == null) return respond(rpcError(null, -32700, 'Parse error'), 400);

  if (Array.isArray(body)) {
    const results = [];
    for (const msg of body) {
      const r = await handleMessage(msg, ctx);
      if (r) results.push(r);
    }
    return results.length ? respond(results) : respond(null, 202);
  }

  const result = await handleMessage(body, ctx);
  return result ? respond(result) : respond(null, 202);
}

// Stateless mode only — no server-initiated SSE stream to resume.
export async function GET() {
  return respond(rpcError(null, -32000, 'This endpoint only supports POST (stateless MCP, no SSE stream).'), 405);
}
