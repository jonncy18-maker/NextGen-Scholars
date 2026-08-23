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

Bearer token, verified against the `mcp_api_keys` table (`lib/mcp-auth.js`) —
not a Better Auth session, since an MCP client's config is static and has no
browser in the loop to refresh a short-lived JWT. Every key is full-mentor
scope; there's no scholar-restricted variant.

**Generating a key:** insert a row with a hashed token, e.g.:

```sql
insert into mcp_api_keys (label, token_hash)
values ('some label', encode(digest('<paste a long random token>', 'sha256'), 'hex'));
```

Give the plaintext token to whoever's configuring the client; only the hash
is ever stored. **Revoke** a key by setting `revoked_at = now()` — never
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

### claude.ai web Connectors (custom connector) — not supported yet

The web Settings → Connectors "Add custom connector" flow expects the server
to run a full OAuth 2.1 authorization flow (discovery + dynamic client
registration) — pointing it at this URL fails with a sign-in/registration
error, and there's no Client ID to paste in that fixes it, since this app
doesn't run an OAuth authorization server. Wiring that up (an
`/.well-known/oauth-protected-resource` endpoint, an authorization + token
endpoint, dynamic client registration) is tracked as a **Phase 2** follow-up
so this can be added as a connector from anywhere, not just Claude Code.
Until then, use Claude Code as above.

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
