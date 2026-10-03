# NextGen Scholars — Architecture reference

Reference material moved out of `CLAUDE.md` when the agent instructions were split into `AGENTS.md` (shared rules) + `CLAUDE.md` (Claude Code only). Rules live in `AGENTS.md`; this file is the map.

## Routes

| Route | Component | Role |
|---|---|---|
| `/` | `HomePage` | Public homepage (hero, tracks, journey, "Meet the Scholars", apply form). |
| `/login` | `LoginPage` (`src/entries/login.jsx`) | Generic sign-in for the nav "Login" button — no person/name is picked up front. Signs in, then `GET /api/me` (role + `scholarKey` resolved server-side) decides the destination: `/navigator` for mentors, `/home/:scholar` for scholars. Replaces the old `HomePage.jsx` "Who's signing in?" destination-picker modal. |
| `/claire`, `/april` | Profile pages | Public scholar dashboards (Claire active BSN; April trial Grade 11). |
| `/janndilyne` | Profile page | Public TESDA scholar dashboard (unadvertised — not linked from homepage). |
| `/navigator/*` | `Navigator` | **Private** mentor ops dashboard. Real Better Auth sign-in (`LockScreen.jsx`). |
| `/entry` | Entry app | Scholar-facing data-entry portal. Real Better Auth sign-in (`ScholarAuthGate.jsx`). |
| `/home/:scholar` | `ScholarHome` | Scholar personal dashboard. Real Better Auth sign-in. |
| `/english/:scholar` | `EnglishTracking` | English / OET progress tracking. Real Better Auth sign-in. |
| `/grades/:scholar` | `GradeEntry` | GPA / grade entry. Real Better Auth sign-in. |
| `/vacation/:scholar` | `VacationTracker` | Reward-trip tracker. Real Better Auth sign-in. |
| `/milestones/:scholar` | `MilestonesTracker` | Reward-milestone tracker. Real Better Auth sign-in. |
| `/budget/:scholar` | `LivingBudget` | Scholar's **own** living-expense budget with user-defined categories. Real Better Auth sign-in. Not the program budget — see `AGENTS.md` "Two money ledgers". |

## Files

| File/Path | Role |
|---|---|
| `app/` | Next.js App Router — file-based routes, each a thin client wrapper. `app/layout.jsx` is the document shell; `app/[...legacy]/page.jsx` is the legacy-URL redirect catch-all; `app/navigator/[[...slug]]/page.jsx` drives Navigator's internal sections. |
| `src/entries/` | Route-level entry components (`navigator.jsx`, `claire.jsx`, `april.jsx`, `janndilyne.jsx`, `entry.jsx`), imported by `app/**/page.jsx`. |
| `src/entries/navigator.jsx` | Root `Navigator` component — manages data state, FX state, polling (`useChanges`), renders the section matching its `slug` prop. |
| `src/screens/` | Full-page components (`HomePage`, `ScholarHome`, `EnglishTracking`, `GradeEntry`, `MilestonesTracker`, `VacationTracker`, `FAQPage`). Named `screens/`, not `pages/`, to avoid colliding with Next's Pages Router auto-detection. |
| `src/components/` | Section-level components (alerts, status cards, nav bar, footer, AI panels, etc.). |
| `src/components/expenses/` | Expense sub-components (charts, filter panel, add form, workbench, sort/filter helpers). |
| `src/components/Profile/` | Scholar profile card components. |
| `src/context/FxContext.jsx` | FX rate context + `useFmt()` formatting hook + `useFxState()`. |
| `src/context/DataContext.jsx` | Data context (`DataCtx`) holding the live merged NGS_DATA snapshot. |
| `src/hooks/` | `useLocalStorage`, `useMediaQuery`, `useScholarProfile`. |
| `src/constants.js` | Shared UI constants (`EXPENSE_CATS`, `NAMECLASS`, `CAT_TO_BUCKET`). |
| `src/styles/` | CSS (token-based `--ngs-*` vars, Newsreader/Manrope/IBM Plex Mono, navy + gold). |
| `src/utils.js` | Pure computation helpers (`scholarTotals`, `allExpenses`, `nextMilestone`, `accentFor`, etc.). |
| `src/fx.js` | FX rate helpers — market fetch, localStorage persistence. |
| `scholars-data.js` | Static fallback + narrative/profile/display copy + cosmetic lock password. |
| `db/` | Reference SQL schema (moved from the old `supabase/` in Phase D) — not applied automatically by anything; see `db/README.md`. |
| `lib/db.js` | Lazy Neon serverless client (`@neondatabase/serverless`, HTTP mode) + `selectWhere()` helper. Lazy on purpose — Next's build-time page-data-collection step evaluates route modules, so an eager `neon(...)` call at module scope throws when `DATABASE_URL` isn't set at build time. |
| `lib/auth.js` | JWKS-verified JWT auth (`jose` + `createRemoteJWKSet`, cached) → role/`scholar_key` resolved from `public.user_profile` (never trusted from the token). `requireMentor`/`requireScholarOwn` helpers. |
| `lib/http.js` | `json()` + `withErrorHandling()` response helpers for API routes. |
| `lib/rate-limit.js` | Fixed-window per-IP rate limiter + `readJsonBody()` size cap, backing the two unauthenticated AI routes. Counters live in Neon's `rate_limit` table, not process memory — these are serverless functions, so an in-process counter is per-instance and Vercel scales out under exactly the load the limiter exists to stop. Fails open on DB error. |
| `lib/ai/{context,tier1,tier2,tier3,action}.js` | Tiered AI layer (context builder, deterministic tier1 SQL resolver, tier2 advisory, tier3 ingestion, GCash action matching). `tier2`/`tier3` are provider-switchable (Claude for authenticated callers, Gemini for `ask-public`/`ask-scholar`) — see "Provider routing" below. |
| `lib/ai/claude.js` | Claude call wrapper (`callClaude`, `CLAUDE_MODEL`, `textFromMessage`, `toJsonSchema`) — the AI brain for signed-in accounts. See "Provider routing" below. |
| `lib/ai/tools.js` | **Tool registry** — one entry per operation a signed-in human can perform manually, each declaring `roles`, `mutates`, a function schema (Gemini's OpenAPI-subset shape, converted to Claude's `input_schema` at the call site), a plain-English `summarize()` and a handler. The single source of "what the AI can do". |
| `lib/ai/agent.js` | Tier 4 agent loop — runs Claude with the registry, executes read tools in-loop, **stops and returns a proposal the moment the model calls a mutating tool**. `runConfirmed()` executes only what the human approved. |
| `app/api/agent/route.js` | The agent endpoint (`mode: 'plan' | 'confirm'`), open to **both** signed-in roles. `GET` returns the caller's tool inventory. |
| `src/components/AgentPanel.jsx` | Confirm-card UI for proposed changes (per-row skip, expandable args, per-call save results) + `agentPlan`/`agentConfirm` helpers. Shared by the mentor console and the scholar chat panel. |
| `src/api-loader.js`, `src/api-writer.js` | Neon-backed data loader/writer, one function per operation, imported by every mentor/scholar screen. |
| `app/api/bootstrap/route.js` | One-call data fetch scoped by mentor/scholar role (mentor unscoped, scholar filtered to own `scholar_key`). |
| `app/api/changes/route.js` | Polling endpoint (`?since=` → `{ now, tables }`) consumed by `src/hooks/useChanges.js`. |
| `app/api/config/route.js` | GET/PUT for the `config` table (mentor-only) — currently backs `ProgramDetailsSection.jsx`'s program-details editor, whose text `app/api/ask-public/route.js` reads for the public AI chat's context. |
| `app/api/public/profile/[key]/route.js` | Public, unauthenticated curated whitelist backing the public profile pages — see `ROADMAP.md` "Public-profile dataset leak". |
| `app/api/me/route.js` | Returns `{ role, scholarKey }` for the caller's own token — used by `ScholarAuthGate.jsx` (scholar pages) and `navigator.jsx` (mentor gate) to verify a session actually matches the expected role/scholar before trusting it. |
| `app/api/{ask,ask-scholar,ask-public}/route.js` | AI orchestrators. `ask` is mentor-only (Claude); `ask-scholar`/`ask-public` are unauthenticated by design and stay on Gemini (see `AGENTS.md` "Key rules" and "Provider routing" below). |
| `src/components/TopBar.jsx` | Shared top-bar shell (People-first redesign, 2026-09) for the Navigator and every scholar screen: grouped nav with a tabs row for the active group, an avatar account menu (theme toggle, update check, public site, sign out), and a menu drawer below 1000px. Replaced the old left `Sidebar.jsx`. Mentor groups live in `NAV_GROUPS` (`navigator.jsx`), scholar groups in `scholarNavGroups()` (`ScholarShell.jsx`); section slugs/URLs are unchanged. |
| `src/components/SignInFrame.jsx` | Split-screen sign-in layout (pathway panel + form card, `PasswordInput` with show/hide) shared by `/login`, `ScholarAuthGate` and the Navigator `LockScreen`. Draws only; each caller keeps its own auth logic. Styles: `.si-*` in `entry.css`. |
| `src/components/ScholarAuthGate.jsx` | Real Better Auth sign-in gate for all scholar-facing pages. Admits a scholar for **her own** key, and the **mentor for any** scholar (a mentor's `scholar_key` is null by design, so the old equality check locked the mentor out of every scholar route). Both the mount-time session check and the sign-in path use the same `mayView()` test. |
| `app/api/ask-budget/route.js` + `lib/ai/budget.js` | AI for the living budget. **Authenticated** (`requireScholarOwn`) — unlike `ask-scholar`, because it can propose mutations. Deterministic Tier-1 reads answer common questions with no LLM call; anything else goes to Claude, which **proposes operations only**. The client shows them for approval and applies them via `/api/living/**`, so the AI path has no privilege the manual path lacks. Budget state is read server-side from Neon, never accepted from the caller. |
| `src/lib/auth-client.js` | Better Auth React client (`createAuthClient` + `jwtClient()` plugin) pointed at the Neon Auth base URL. `getToken()` reads the JWT off the `set-auth-jwt` response header. |
| `src/lib/api.js` | Fetch wrapper for `app/api/**` — Bearer token per request via `getToken()`, one 401-retry, `afterWrite()` poke hook consumed by `useChanges.js`. |
| `gh-pages-redirect/` | Static redirect stub (`index.html` + `404.html`, rafgraph/spa-github-pages trick) published to GitHub Pages by `.github/workflows/deploy.yml` — forwards old bookmarks/hash routes to the Vercel domain. No build step; not part of the Next.js app. |

## Data architecture

Three layers, merged at runtime:

- **`scholars-data.js`** — static fallback and narrative fields: scholar bio, English
  profile, public profile copy, program config (`lastUpdated`, `exchangeRate`), and
  the cosmetic lock password. Source of truth for hand-authored fields not held in
  the database.
- **Neon (Postgres)** — operational data: expenses, GPA history, milestone and
  travel states, budgets, alerts, deadlines, action items, English periods,
  career steps. Source of truth for anything the mentor edits week-to-week.
  (Supabase held this data pre-cutover; see `ROADMAP.md` → "Phase 5" for the
  migration history. The
  `documents` table exists in Neon's schema but is unused — the Documents
  feature was dropped rather than ported.)
- **Frontend merge layer** — `src/api-loader.js`'s `loadFromSupabase()` (name
  kept from the pre-migration version for call-site parity) fetches
  `/api/bootstrap` in one call, then `Navigator` / `ScholarHome` merge the
  result with the static narrative fields from `scholars-data.js` and store it
  in React state (`const [D, setD] = useState(NGS_DATA)`). All sections read
  from this merged state via `DataCtx`. `Navigator` polls `/api/changes` via
  `src/hooks/useChanges.js` (~25s) so live edits re-render the dashboard.

When Neon is unreachable, the app falls back to `scholars-data.js` as a static
snapshot (nav shows an offline indicator).

## navigator.jsx + DataContext

- The data snapshot is held in React state inside `Navigator` (not a mutable module
  variable), so polled updates trigger a full re-render of all sections.
- Components read the live snapshot via `useData()` from `DataContext`.
- `scholars-data.js` exports a named ES module export: `export const NGS_DATA = {...}`.
  Import it as `import { NGS_DATA } from '../../scholars-data.js'`.

## AI layer

A tiered intelligence system behind the `/api/ask*` routes (`lib/ai/{context,tier1,
tier2,tier3,action}.js`, ported verbatim from the original Supabase Edge Functions).
Tier 1 is a deterministic, rule-based SQL resolver (no LLM, ~80% of queries); Tier 2
is LLM advisory; Tier 3 is LLM multimodal ingestion (receipts, grade reports).
See `ROADMAP-AI.md` for full status.

### Provider routing (2026-08-24) — Claude for signed-in accounts, Gemini for the public

The AI brain is **Claude Sonnet** (`claude-sonnet-5`, `lib/ai/claude.js`) for every
route gated behind a real Better Auth sign-in — `app/api/ask` (mentor), `app/api/
ask-budget` (scholar), and `app/api/agent` (both roles, Tier 4) — since both signed-in
roles now share the same universal Tier 4 tool surface and it made sense to put one
model behind all of it. The two **unauthenticated, public-facing** routes stay on
Gemini exactly as before: `app/api/ask-public` (homepage widget) and `app/api/
ask-scholar` (documented unauthenticated fallback — see its own rule in `AGENTS.md` "Key rules"). Gemini's
`GOOGLE_AI_KEY` and Claude's `ANTHROPIC_API_KEY` are both server-only Vercel env vars;
neither is ever sent to the client.

### Tier 4 — the agent (2026-08-13)

Tiers 1–3 each answer one fixed shape of question and are effectively read-only.
Tier 4 (`app/api/agent`, `lib/ai/{tools,agent}.js`) gives the AI **capability parity
with the manual UI**: every operation a signed-in human can perform has exactly one
entry in `lib/ai/tools.js`, and Claude reaches them by tool use (the registry declares
parameters in Gemini's OpenAPI-subset shape for historical reasons — `lib/ai/claude.js`'s
`toJsonSchema()` converts to Claude's JSON-Schema `input_schema` at the call site rather
than carrying two parallel schemas). 36 tools for the mentor role, 18 for a scholar.

The three safety rules and the parity contract are in `AGENTS.md` → "Tier 4 — the agent".

Surfaces: the mentor console routes non-expense change requests to it (`agent`
intent in `NavigatorAIConsole.jsx`, also selectable manually); `ScholarChatPanel.jsx`
uses it as its primary path on all scholar pages, falling back to the older
unauthenticated `/api/ask-scholar` only on 401/503. Existing expense ingest/bulk-edit
flows keep their purpose-built review cards and are unchanged.

### MCP server (2026-09-27) — `app/api/mcp/ngs`, ported from Personal-Dashboard

The Tier 4 tool registry (`lib/ai/tools.js`) is also exposed over the Model
Context Protocol, so claude.ai/Claude Desktop and ChatGPT can operate the
dashboard directly — "the MCP should be able to do everything a mentor can do
manually" was the ask, and the registry already is that list, so no second
catalog was written. `lib/ai/mcp-tools.js` re-keys `TOOLS` (Gemini-shaped
`parameters`) to MCP's `inputSchema` + `annotations` (`readOnlyHint` for
non-mutating tools, `destructiveHint` for `delete_*`) the same way
`lib/ai/agent.js`'s `claudeTools()` re-keys it for Claude's `input_schema` —
one registry, three wire shapes, never three tool lists.

- **Always authenticates as the mentor role, unscoped.** This is the
  operational surface (every scholar, not one), matching the sibling
  Personal-Dashboard repo's own single-bearer-token MCP servers rather than
  Neon Auth's per-user JWTs — a real account login isn't the right shape for
  an always-on connector credential. Gated by `NGS_MCP_TOKEN` (Vercel env
  var, both Production and Preview).
- **Every tool — reads and writes alike — is callable directly**, unlike the
  in-app agent's plan/confirm split. That split exists because an LLM
  *inside this app* proposes calls a human then approves; here the
  connecting client's own model calls tools directly and its own
  tool-approval UI (Claude Desktop/claude.ai's per-call confirmation,
  ChatGPT's own) is the confirmation step instead. `destructiveHint` on
  every `delete_*` tool is what that UI keys off of.
- **Transport + OAuth are `lib/mcp-server.js` / `lib/mcp-oauth.js`, ported
  near-verbatim from Personal-Dashboard**, which proved this approach first:
  one JSON-RPC POST handler (`initialize`/`tools/list`/`tools/call`) behind a
  bearer check, plus a full OAuth 2.1 + dynamic-client-registration handshake
  (`/authorize`, `/token`, `/register`, the `.well-known/oauth-*` metadata
  routes) purely so claude.ai's hosted "Add custom connector" flow — which
  hard-requires OAuth — can reach it. The token that handshake ultimately
  hands back **is** `NGS_MCP_TOKEN` itself; there is no second credential.
  Auth codes live in `mcp_auth_codes` (`db/mcp_auth_codes.sql`, applied to
  Neon the same day) — single-use, PKCE-checked, scoped by a `server` column
  in case a second MCP server is ever added here.
- **`app/api/chatgpt/mcp/route.js` is a one-line re-export of the same
  handler**, purely because ChatGPT's connector UI hard-requires the URL to
  end in `/mcp` — an OpenAI constraint, not an MCP-spec one. ChatGPT's
  "Access token / API key" connector mode sends `NGS_MCP_TOKEN` as a bare
  bearer header, so it needs no OAuth wrapper — set it up as: Settings →
  Apps & Connectors → Developer Mode → Create → URL
  `https://next-gen-scholars-jonncy18.vercel.app/api/chatgpt/mcp`, auth
  "Access token / API key" with `NGS_MCP_TOKEN`'s value. Requires a paid
  ChatGPT plan (Developer Mode isn't on the free tier). claude.ai instead
  uses "Add custom connector" with the plain `/api/mcp/ngs` URL and goes
  through the OAuth flow above.
- **House rules travel via the MCP `initialize` response's `instructions`
  field** (`ngsMcpInstructions()` in `lib/ai/mcp-tools.js`) — the closest
  MCP-native equivalent of `lib/ai/agent.js`'s system prompt, since an
  externally-connected client's own model never sees that prompt.

## Immersion hours integration (2026-07-06)

The mentor's Navigator "English" section (`src/components/EnglishSection.jsx`,
`GET /api/immersion-hours`) shows **live** hours/status pulled directly from
NextGen Immersion (`jonncy18-maker/NextGen-Immersion`,
https://next-gen-immersion.vercel.app/) — a completely separate app with its
own Neon project (`silent-cherry-49841538`, "NGS - Immersion") and its own
Neon Auth account system. There is no shared login, scholar key, or user ID
between the two apps.

- **`GET /api/immersion-hours` is scholar- and mentor-accessible** (`requireScholarOwn`,
  not `requireMentor`) — a mentor gets every mapped scholar's hours, a scholar
  gets only their own (or `{}` if they have no Immersion account). This backs
  `EnglishSection.jsx` (mentor Navigator), `MentorHome.jsx`'s per-scholar stat +
  cohort "This Week" pulse, `RiskSection.jsx`'s "OET English" risk metric
  (adopts Immersion's own ON_TRACK/AT_RISK/PENDING `status` and per-scholar
  `targetHours` rather than a hardcoded threshold), and `ScholarHome.jsx`'s own
  "English Hours" stat card/tracker tile — all five now read the same live
  number instead of the dead local `english_sessions` totals.
- **Scholar mapping is hardcoded**, since there's no shared identifier:
  `IMMERSION_USER_ID` in `app/api/immersion-hours/route.js` maps our
  scholar keys to Immersion's `users.id` (a Neon-Auth-issued uuid), looked
  up by hand once via the Neon console. Janndilyne isn't in the map — she's
  TESDA-track with no Immersion account, and `EnglishSection.jsx` already
  excludes TESDA scholars from this section entirely.
- **This app's own `english_periods`/`english_sessions` tables are now
  dead for the mentor view** — `EnglishSection.jsx` doesn't read them at
  all anymore (it did briefly, in a since-reverted version, which is why
  the mentor originally saw stale/wrong hours: those tables have had no
  writer since mentor editing was removed from this section). They're
  still written to by the *scholar-facing* pages
  (`EnglishTracking.jsx`/`ScholarHome.jsx`) and read by
  `MentorHome.jsx`/`RiskSection.jsx` — only the mentor's dedicated English
  section switched over to Immersion as its source of truth.

- If a new scholar joins Immersion, add their `IMMERSION_USER_ID` entry by
  querying `select id, scholar_name from users where role = 'scholar'` in
  the Immersion Neon project (readable via the same `ngs_scholars_reader`
  role) and asking the owner which row is which person.

## Wide-screen layout

`ScholarHome` (`.sh-*` in `src/styles/scholar-home.css`) is phone-first: greeting,
a slim pathway stepper (`src/lib/pathway.js` derives stages per track — NGN / NGH,
and no strip for a scholar not on a track), the money card with "Snap receipt" /
"+ Add", then compact Progress / Coming up / Recent cards; from 1000px (the
drawer breakpoint) the cards sit in a 2x2 grid. Below 1000px scholar screens get
a bottom tab bar (`TopBar` `tabBar`, derived from `scholarNavGroups()`) and the
floating AI launcher sits above it. The mentor sets a scholar's track
(NGN / NGH / none → NULL) on the Navigator portfolio card, via
`PATCH /api/scholars/[key]` or the `set_scholar_track` tool. Navigator Portfolio (`.mh-*` in `shell.css`) is a
responsive grid of scholar cards. The expense-entry page (`src/styles/entry.css`)
still switches to its own two-column grid at wide sizes (`grid-template-areas`),
with chat/form/receipt-upload in a left rail next to the pending-review list and
expense table. Default theme is **dark** (the pre-paint script in
`app/layout.jsx` falls back to dark when `ngs_theme` isn't set); light mode is a
warm-paper palette defined by the `--ds-*` tokens in `shell.css`.
