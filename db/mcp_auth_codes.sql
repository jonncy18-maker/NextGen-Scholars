-- Single-use OAuth authorization codes for the app's MCP server
-- (app/api/mcp/ngs, lib/mcp-oauth.js). One table serves any MCP server this
-- app ever exposes — `server` (the token env var name, e.g. 'NGS_MCP_TOKEN')
-- scopes each code to the server that issued it, so a code minted for one
-- server can't be redeemed at another's /token. Applied 2026-09-27 alongside
-- the MCP server itself (see CLAUDE.md "AI layer" / "MCP server").
create table if not exists mcp_auth_codes (
  code                    text primary key,
  server                  text not null,
  code_challenge          text,
  code_challenge_method   text default 'S256',
  redirect_uri            text not null,
  expires_at              timestamptz not null,
  created_at              timestamptz not null default now()
);

create index if not exists mcp_auth_codes_expires_at_idx on mcp_auth_codes (expires_at);
