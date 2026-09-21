# MCP server — Claude with full mentor access

`app/api/mcp/route.js` exposes the entire `lib/ai/tools.js` registry (every
read/write operation a signed-in mentor can perform through the UI) as an MCP
server, so an MCP client — Claude Desktop, Claude Code, any other MCP host —
can act on the live NGS data directly, with the same validation and
category/scholar-scoping rules the in-app Tier 4 agent uses.

## How it differs from the in-app AI (`/api/agent`)

`/api/agent` never runs a mutating tool inside the model's loop — it stops
and returns a proposal, and only a second, human-confirmed request executes
it. This MCP endpoint runs mutating tools immediately on `tools/call`. That's
deliberate: the human-in-the-loop here is the **MCP client's own** tool-call
approval (e.g. Claude Code's permission prompt before it runs a tool), not
the app's confirm-card UI. There's nowhere in the MCP protocol to add a
second round trip, so don't try to bolt one on — just be aware that whatever
approval step your MCP client offers *is* the safety gate for writes.

## Auth

Every request to `/api/mcp` needs a Bearer token verified against the
`mcp_api_keys` table (`lib/mcp-auth.js`) — not a Better Auth session, since
an MCP client's config can't hold onto a short-lived JWT the way a browser
session does. Every key is full-mentor scope; there's no scholar-restricted
variant. Two ways a token ends up in that table:

1. **Manually generated** — insert a row with a hashed token yourself:
   ```sql
   insert into mcp_api_keys (label, token_hash)
   values ('some label', encode(digest('<paste a long random token>', 'sha256'), 'hex'));
   ```
   Give the plaintext token to whoever's configuring the client; only the
   hash is ever stored. Used by the Claude Code path below.
2. **Minted through the OAuth flow** (`lib/oauth.js`, `db/oauth.sql`) — a
   real mentor sign-in + consent at `/oauth/authorize` produces one
   automatically, labeled `oauth:<client_id>`. Used by the claude.ai web
   Connectors path below.

**Revoke** any key, either kind, by setting `revoked_at = now()` — never
delete the row, so `last_used_at`/`label` stay around for audit.

## Client config

This is a stateless "Streamable HTTP" MCP server (POST-only JSON-RPC, no
`Mcp-Session-Id`, no server-initiated SSE stream) — every request carries
full context via the bearer token, so there's no session state to track
between calls.

### Claude Code (supported today)

The repo's `.mcp.json` already points at this server:

```json
{
  "mcpServers": {
    "nextgen-scholars": {
      "type": "http",
      "url": "https://next-gen-scholars-jonncy18.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer ${NGS_MCP_TOKEN}" }
    }
  }
}
```

`.mcp.json` is committed (no secret in it) — the token itself comes from
your **local** shell environment, never from the repo. Before opening Claude
Code in this project, set:

```bash
export NGS_MCP_TOKEN="<your key>"
```

(e.g. in `~/.zshrc`/`~/.bashrc`). Claude Code expands `${NGS_MCP_TOKEN}` in
`.mcp.json` at connection time. From here it's just a normal MCP server —
Claude Code shows its own per-tool approval prompt before running anything,
which is the human-in-the-loop for writes (see above).

### claude.ai web Connectors (custom connector) — Phase 2, now supported

Settings → Connectors → "Add custom connector" now works: point it at
```
https://next-gen-scholars-jonncy18.vercel.app/api/mcp
```
with no headers. `/api/mcp` responds to an unauthenticated request with a
`WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"`
header; claude.ai follows that to `/.well-known/oauth-protected-resource` →
`/.well-known/oauth-authorization-server` (RFC 9728 / RFC 8414), registers
itself via `POST /api/oauth/register` (RFC 7591, no client secret — PKCE
carries the security per OAuth 2.1), then opens `/oauth/authorize` in a
browser tab. That page (`app/oauth/authorize/page.jsx`) is a real mentor
sign-in (same Better Auth session as the rest of the app) followed by an
explicit consent screen; approving it calls `POST /api/oauth/authorize`,
which mints a single-use authorization code, and claude.ai exchanges that at
`POST /api/oauth/token` for an access token — written into `mcp_api_keys`
exactly like a manually-generated key, so nothing about `/api/mcp` itself
needed to change. No refresh tokens; revoke the same way as any other key.

### Claude Desktop

Same shape of config (`type: "http"`, `url`, `headers.Authorization`) goes
into Claude Desktop's own MCP settings. Check Claude Desktop's current docs
for whether it expands `${VAR}` in header values the way Claude Code does —
if not, the token has to go directly in that config instead of via env var,
so treat that config file as sensitive.

## What it can do

`tools/list` returns the same 36 mentor tools as the in-app agent (see
`lib/ai/tools.js`'s header for the full contract): list/read every table,
add/edit/delete expenses and grades, approve/reject scholar submissions, log
and edit English sessions and periods, manage career-pathway steps, program
config, alerts and action items. **When a new manual operation gets a tool
entry in `lib/ai/tools.js`, it's automatically available here too** — this
endpoint has no separate tool list to keep in sync.
