// ChatGPT's custom-connector setup requires the MCP endpoint URL to
// literally end in `/mcp` (a hard requirement of its connector UI, unrelated
// to the MCP spec itself) — `/api/mcp/ngs` doesn't satisfy that, so this
// route exists purely as a second, ChatGPT-shaped URL for the exact same
// handler. No new tool catalog, no new auth logic: same NGS_MCP_TOKEN
// bearer check, same tools. ChatGPT's own "Access token / API key" connector
// mode sends that same bearer header on every request, so no OAuth wrapper
// is needed here the way claude.ai's connector requires one.
//
// Set up on ChatGPT's side as: Settings → Apps & Connectors → Developer Mode
// → Create → URL `https://<vercel-domain>/api/chatgpt/mcp`, auth
// "Access token / API key" with NGS_MCP_TOKEN's value pasted in. Requires a
// paid ChatGPT plan (Plus or above) — Developer Mode isn't on the free tier.
export { POST } from '../../mcp/ngs/route.js';
