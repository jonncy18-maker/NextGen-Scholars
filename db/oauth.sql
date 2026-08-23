-- OAuth 2.1 authorization-code + PKCE support for the MCP endpoint
-- (app/api/mcp/route.js), so a remote MCP client (claude.ai web Connectors,
-- Claude Desktop, etc.) can complete a real sign-in flow instead of needing
-- a manually-pasted static key. Applied directly to Neon
-- (patient-flower-81986836) — this file documents it, same convention as
-- living_budget.sql; nothing in the app runs it automatically.
--
-- Access tokens minted by this flow are written straight into the existing
-- mcp_api_keys table (see mcp_api_keys.sql) — same verification path
-- (lib/mcp-auth.js) as a manually-generated key, so nothing about the MCP
-- route itself had to change.

-- Dynamic client registration (RFC 7591, public-client subset — no secret,
-- PKCE carries the security). client_id is handed out freely; the real
-- gate is the mentor's own sign-in + consent at the /oauth/authorize page.
create table if not exists oauth_clients (
  client_id text primary key,
  redirect_uris jsonb not null,
  client_name text,
  created_at timestamptz not null default now()
);

-- Short-lived, single-use authorization codes. Only the hash is stored.
create table if not exists oauth_auth_codes (
  code_hash text primary key,
  client_id text not null references oauth_clients(client_id),
  redirect_uri text not null,
  code_challenge text not null,
  user_id text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
