import crypto from 'node:crypto';
import { sql } from './db.js';

// Auth for the MCP endpoint (app/api/mcp/route.js) — deliberately separate
// from lib/auth.js's requireMentor/requireScholarOwn. Those verify a Better
// Auth JWT, which is short-lived and minted through an interactive browser
// sign-in; an MCP client (Claude Desktop/Code config) holds a static
// connection config with no browser in the loop to refresh a token. So this
// route instead accepts a long-lived personal API key, stored hashed in
// `mcp_api_keys` (see db/mcp_api_keys.sql) and generated once via the Neon
// console/MCP tools — never through the app itself.
//
// Every key here grants full mentor access — this endpoint IS "everything I
// can do manually" for the program owner, not a scoped scholar surface, so
// there is no scholarKey variant.

class McpAuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function requireMcpKey(request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) throw new McpAuthError(401, 'Missing bearer token');

  const tokenHash = hashToken(token);
  const [row] = await sql`
    select id from mcp_api_keys where token_hash = ${tokenHash} and revoked_at is null
  `;
  if (!row) throw new McpAuthError(401, 'Invalid or revoked API key');

  // Best-effort; a failed timestamp bump should never block the call it's tracking.
  sql`update mcp_api_keys set last_used_at = now() where id = ${row.id}`.catch(() => {});

  return { role: 'mentor', scholarKey: null };
}

export { McpAuthError };
