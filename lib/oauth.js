import crypto from 'node:crypto';
import { sql } from './db.js';

// OAuth 2.1 authorization-code + PKCE flow backing the MCP endpoint's
// "claude.ai web Connectors" path — see docs/MCP.md and db/oauth.sql.
//
// Deliberately minimal: no client secrets (public clients, PKCE-only, per
// RFC 7591/OAuth 2.1 guidance for clients that can't keep a secret), no
// refresh tokens (the issued access token is the same non-expiring shape as
// a manually-generated mcp_api_keys row — revoke it the same way, by setting
// revoked_at). The thing this flow actually gates is: only a real mentor
// sign-in + explicit consent at /oauth/authorize can mint a token at all.

class OAuthError extends Error {
  constructor(status, code, description) {
    super(description);
    this.status = status;
    this.code = code;
  }
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}
function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}
function base64urlSha256(input) {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

export async function registerClient({ redirect_uris, client_name }) {
  if (!Array.isArray(redirect_uris) || !redirect_uris.length) {
    throw new OAuthError(400, 'invalid_client_metadata', 'redirect_uris is required');
  }
  for (const uri of redirect_uris) {
    let parsed;
    try {
      parsed = new URL(uri);
    } catch {
      throw new OAuthError(400, 'invalid_redirect_uri', `Invalid redirect_uri: ${uri}`);
    }
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !isLocal) {
      throw new OAuthError(400, 'invalid_redirect_uri', `redirect_uri must be https: ${uri}`);
    }
  }
  const clientId = randomToken(16);
  const [row] = await sql`
    insert into oauth_clients (client_id, redirect_uris, client_name)
    values (${clientId}, ${JSON.stringify(redirect_uris)}::jsonb, ${client_name || null})
    returning client_id, redirect_uris, client_name, created_at
  `;
  return row;
}

export async function getClient(clientId) {
  const [row] = await sql`select client_id, redirect_uris, client_name from oauth_clients where client_id = ${clientId}`;
  return row || null;
}

function checkRedirect(client, redirectUri) {
  const allowed = Array.isArray(client.redirect_uris) ? client.redirect_uris : [];
  if (!allowed.includes(redirectUri)) {
    throw new OAuthError(400, 'invalid_request', 'redirect_uri does not match a registered value for this client');
  }
}

export async function createAuthorizationCode({ clientId, redirectUri, codeChallenge, codeChallengeMethod, userId }) {
  const client = await getClient(clientId);
  if (!client) throw new OAuthError(400, 'invalid_client', 'Unknown client_id');
  checkRedirect(client, redirectUri);
  if (codeChallengeMethod !== 'S256' || !codeChallenge) {
    throw new OAuthError(400, 'invalid_request', 'PKCE (S256 code_challenge) is required');
  }
  const code = randomToken(32);
  await sql`
    insert into oauth_auth_codes (code_hash, client_id, redirect_uri, code_challenge, user_id, expires_at)
    values (${sha256Hex(code)}, ${clientId}, ${redirectUri}, ${codeChallenge}, ${userId}, now() + interval '5 minutes')
  `;
  return code;
}

export async function exchangeAuthorizationCode({ code, clientId, redirectUri, codeVerifier }) {
  if (!code || !codeVerifier) throw new OAuthError(400, 'invalid_request', 'code and code_verifier are required');

  const codeHash = sha256Hex(code);
  const [row] = await sql`select * from oauth_auth_codes where code_hash = ${codeHash}`;
  if (!row) throw new OAuthError(400, 'invalid_grant', 'Unknown or expired code');
  if (row.used_at) throw new OAuthError(400, 'invalid_grant', 'Code already used');
  if (new Date(row.expires_at) < new Date()) throw new OAuthError(400, 'invalid_grant', 'Code expired');
  if (row.client_id !== clientId) throw new OAuthError(400, 'invalid_grant', 'client_id mismatch');
  if (row.redirect_uri !== redirectUri) throw new OAuthError(400, 'invalid_grant', 'redirect_uri mismatch');
  if (base64urlSha256(codeVerifier) !== row.code_challenge) {
    throw new OAuthError(400, 'invalid_grant', 'PKCE verification failed');
  }

  // The actual single-use guarantee: an update scoped to used_at is null,
  // not the read above (which just produces a friendlier error on replay).
  const [claimed] = await sql`
    update oauth_auth_codes set used_at = now() where code_hash = ${codeHash} and used_at is null returning code_hash
  `;
  if (!claimed) throw new OAuthError(400, 'invalid_grant', 'Code already used');

  const token = `ngs_mcp_${randomToken(32)}`;
  await sql`insert into mcp_api_keys (label, token_hash) values (${'oauth:' + clientId}, ${sha256Hex(token)})`;
  return token;
}

export { OAuthError };
