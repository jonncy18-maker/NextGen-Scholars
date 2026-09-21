-- Personal API keys for the MCP endpoint (app/api/mcp/route.js), backing
-- lib/mcp-auth.js. Applied directly to Neon (patient-flower-81986836) — this
-- file documents it, same convention as living_budget.sql; nothing in the app
-- runs it automatically.
--
-- Only the hash is ever stored. The plaintext key is generated once, shown to
-- the owner, and never persisted anywhere else.
create table if not exists mcp_api_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
