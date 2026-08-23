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

Point an MCP client at:

```
https://next-gen-scholars-jonncy18.vercel.app/api/mcp
```

with header:

```
Authorization: Bearer <token>
```

This is a stateless "Streamable HTTP" MCP server (POST-only JSON-RPC, no
`Mcp-Session-Id`, no server-initiated SSE stream) — every request carries
full context via the bearer token, so there's no session state to track
between calls.

## What it can do

`tools/list` returns the same 36 mentor tools as the in-app agent (see
`lib/ai/tools.js`'s header for the full contract): list/read every table,
add/edit/delete expenses and grades, approve/reject scholar submissions, log
and edit English sessions and periods, manage career-pathway steps, program
config, alerts and action items. **When a new manual operation gets a tool
entry in `lib/ai/tools.js`, it's automatically available here too** — this
endpoint has no separate tool list to keep in sync.
