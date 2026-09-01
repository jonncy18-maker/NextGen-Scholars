# NextGen Scholars — Project Context

Private mentorship-program website + mentor dashboard for a privately funded
program supporting Filipino nursing students (NGN track) on a pathway toward
licensure abroad (PH → OET → NCLEX → AHPRA Australia).

- **Repo:** `jonncy18-maker/NextGen-Scholars` (renamed from `NexGen`)
- **Live:** https://next-gen-scholars-jonncy18.vercel.app (Vercel, `main`).
  The old GitHub Pages URL (https://jonncy18-maker.github.io/NextGen-Scholars/)
  is now a frozen redirect stub (`gh-pages-redirect/`) forwarding old
  bookmarks/hash routes to the Vercel domain — it no longer serves the app.
- **Stack:** Next.js 16 (App Router) + React 18, backed by Neon (serverless
  Postgres) + Neon Auth (Better Auth) + Next.js API routes, deployed on
  Vercel. Cut over from Vite/HashRouter/Supabase on **2026-07-04** (PR #183);
  Supabase decommission (Phase D) completed the same week — no code in this
  repo depends on Supabase anymore. Full migration history:
  `ROADMAP.md` → "Phase 5 — Migration: Supabase → Neon + Vercel".

> **Personal context:** John maintains a dated personal-context doc (background,
> constraints, review priorities as the builder) in this Google Drive folder:
> https://drive.google.com/drive/folders/1cjNFhY6ZnN5xB4PSDhz7FA24KGl92NTy — titles
> are date-stamped (e.g. `Personal_Context_YYYY-MM-DD.md`). At session start, or
> whenever asked to review this repo "against what you know about me," use the
> Google Drive tools to find the **most recently dated** file in that folder (don't
> assume a fixed filename — a newer one may have been added) and weigh suggestions
> against it, not just generic best practice.

## Build system

> **Upgraded to Next.js 16 on 2026-07-25.** Two things to know. (1) `params` in
> both route handlers and page components is now a **Promise** — route handlers
> do `const { id } = await params`, and client pages (which cannot be `async`)
> unwrap it with `React.use(params)`. This is the upgrade's one real trap: a
> sync `params.id` access still *builds clean* and silently yields `undefined`
> at runtime, so it breaks in production rather than in CI. Verify dynamic
> routes by actually hitting them, not by a green build. (2) `next build` now
> uses Turbopack by default. `package.json` carries `overrides` pinning `sharp`
> and `postcss` to patched versions — both are transitive deps of `next` that
> npm audit flags; drop the overrides once next's own ranges catch up.

A Next.js **App Router** app. `app/**/page.jsx` files are thin `'use client'`
wrappers around the pre-existing screen/component code under `src/` — route params
arrive as the page's `params` prop rather than via `useParams()`. `app/layout.jsx` is
the document shell (global CSS, error boundary). `app/[...legacy]/page.jsx` reproduces
the old legacy-URL redirect behavior (`claire.html`, `navigator.html`, `?scholar=`
query forms, and any other unrecognised path) client-side. Note: full-page components
live in **`src/screens/`**, not `src/pages/` — a directory literally named
`src/pages/` collides with Next.js's (legacy) Pages Router auto-detection.

```bash
npm install
npm run dev      # Next dev server — http://localhost:3000/
npm run build    # Production build (next build)
npm run start    # Serve the production build locally
npm run format   # Prettier — src/**/*.{js,jsx,css}, app/**/*.jsx, and scholars-data.js
```

Env vars are `NEXT_PUBLIC_*` (not Vite's `VITE_*`) — see `.env.example`.

## API Key / Security Rules

| Key | Prefix | Lives | Why |
|---|---|---|---|
| `DATABASE_URL` | none | Server only (`lib/db.js`) | Neon connection string — full DB access if leaked. |
| `GOOGLE_AI_KEY` | none | Server only (`lib/ai/*`, `app/api/{ask-scholar,ask-public}/*`) | Gemini API key — powers the two **unauthenticated, public-facing** AI routes only. Quota abuse risk if exposed client-side. |
| `ANTHROPIC_API_KEY` | none | Server only (`lib/ai/*`, `app/api/{ask,ask-budget,agent}/*`) | Claude API key — the AI brain for **signed-in mentor/scholar accounts**. Quota abuse risk if exposed client-side. |
| `IMMERSION_DATABASE_URL` | none | Server only (`lib/immersion-db.js`, `app/api/immersion-hours/route.js`) | Read-only connection to the separate NextGen Immersion app's Neon project, using a dedicated `ngs_scholars_reader` role — see "Immersion hours integration" below. |

**Rule:** anything that touches the Neon database directly or calls Gemini/Claude
runs only in `app/api/**` route handlers; the browser calls those routes,
never Neon, Gemini, or Claude directly. Never commit a value for any key — set
all of them in Vercel's project env vars only.

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
| `/budget/:scholar` | `LivingBudget` | Scholar's **own** living-expense budget with user-defined categories. Real Better Auth sign-in. Not the program budget — see "Two money ledgers" below. |

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
| `app/api/mcp/route.js`, `lib/mcp-auth.js`, `lib/mcp/json-schema.js` | MCP server exposing the full `lib/ai/tools.js` registry to any MCP client (Claude Desktop/Code, claude.ai web Connectors, etc.) with full mentor access, authenticated by a bearer token in `mcp_api_keys` rather than a Better Auth session. Unlike `/api/agent`, mutating tools run immediately on `tools/call` — the human-in-the-loop is the MCP client's own tool-approval step, not a confirm-card round trip. See `docs/MCP.md`. |
| `lib/oauth.js`, `app/api/oauth/{register,authorize,token}/route.js`, `app/oauth/authorize/page.jsx`, `app/.well-known/oauth-*/route.js` | OAuth 2.1 (PKCE, dynamic client registration) authorization-code flow so a remote MCP client (claude.ai web Connectors) can self-serve a token instead of needing a manually-pasted key. Mints tokens straight into `mcp_api_keys` — `/api/mcp` itself is unchanged. The `/oauth/authorize` page is a real mentor sign-in + consent screen; only a mentor may grant access. |
| `lib/app-url.js` | `getAppUrl()` — the base origin the OAuth/MCP discovery routes (`app/.well-known/oauth-*`, `app/api/mcp/route.js`) advertise to a connecting client. Deployment-aware via Vercel's `VERCEL_ENV`/`VERCEL_URL`/`VERCEL_PROJECT_PRODUCTION_URL`: a preview deployment advertises its own preview origin, production advertises the canonical domain. A hardcoded production URL here previously broke claude.ai's OAuth discovery from any preview deployment (it advertised endpoints that only exist on the PR, not on production) — any new route that needs to self-reference its own origin should use this instead of a literal string. |
| `src/components/AgentPanel.jsx` | Confirm-card UI for proposed changes (per-row skip, expandable args, per-call save results) + `agentPlan`/`agentConfirm` helpers. Shared by the mentor console and the scholar chat panel. |
| `src/api-loader.js`, `src/api-writer.js` | Neon-backed data loader/writer, one function per operation, imported by every mentor/scholar screen. |
| `app/api/bootstrap/route.js` | One-call data fetch scoped by mentor/scholar role (mentor unscoped, scholar filtered to own `scholar_key`). |
| `app/api/changes/route.js` | Polling endpoint (`?since=` → `{ now, tables }`) consumed by `src/hooks/useChanges.js`. |
| `app/api/config/route.js` | GET/PUT for the `config` table (mentor-only) — currently backs `ProgramDetailsSection.jsx`'s program-details editor, whose text `app/api/ask-public/route.js` reads for the public AI chat's context. |
| `app/api/public/profile/[key]/route.js` | Public, unauthenticated curated whitelist backing the public profile pages — see "Public-profile dataset leak" below. |
| `app/api/me/route.js` | Returns `{ role, scholarKey }` for the caller's own token — used by `ScholarAuthGate.jsx` (scholar pages) and `navigator.jsx` (mentor gate) to verify a session actually matches the expected role/scholar before trusting it. |
| `app/api/{ask,ask-scholar,ask-public}/route.js` | AI orchestrators. `ask` is mentor-only (Claude); `ask-scholar`/`ask-public` are unauthenticated by design and stay on Gemini (see "Key Rules for Claude Code" and "Provider routing" above). |
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
- **Security note:** the `password` in `scholars-data.js` is **cosmetic only**. The file
  is a public static asset — anyone can read it. Do not treat this as real access control
  (see ROADMAP "Accepted risks").

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
ask-scholar` (documented unauthenticated fallback — see its own rule below). Gemini's
`GOOGLE_AI_KEY` and Claude's `ANTHROPIC_API_KEY` are both server-only Vercel env vars;
neither is ever sent to the client.

`lib/ai/tier2.js` and `lib/ai/tier3.js` are **shared** between an authenticated caller
(`/api/ask`, Claude) and the unauthenticated `/api/ask-scholar` (Gemini) — both export
their functions with a `provider` parameter (`'claude' | 'gemini'`, default `'gemini'`
so existing unauthenticated call sites are unchanged) rather than carrying two copies
of the same prompt logic. `lib/ai/{action,expense-edit,budget}.js` and `lib/ai/agent.js`
are each used by exactly one authenticated route, so those import `lib/ai/claude.js`
directly with no provider switch. When you add a new authenticated AI call site, route
it through Claude the same way; when you touch `ask-public`/`ask-scholar`, keep it on
Gemini — don't let the two drift back together or split further apart than this.

### Tier 4 — the agent (2026-08-13)

Tiers 1–3 each answer one fixed shape of question and are effectively read-only.
Tier 4 (`app/api/agent`, `lib/ai/{tools,agent}.js`) gives the AI **capability parity
with the manual UI**: every operation a signed-in human can perform has exactly one
entry in `lib/ai/tools.js`, and Claude reaches them by tool use (the registry declares
parameters in Gemini's OpenAPI-subset shape for historical reasons — `lib/ai/claude.js`'s
`toJsonSchema()` converts to Claude's JSON-Schema `input_schema` at the call site rather
than carrying two parallel schemas). 36 tools for the mentor role, 18 for a scholar.

Three rules hold this together — break any one and the safety story is gone:

- **Writes never run inside the model loop.** `runPlan()` executes read tools only;
  the first mutating call ends the loop and comes back as a `proposal`. Writing
  requires a *second*, human-initiated request (`mode: 'confirm'`), re-authorised
  against that request's own token. This is structural, not prompted — a prompt
  injection hidden in an expense note or a scholar's message cannot cause a silent
  write, only a card a human then rejects.
- **The model's arguments are untrusted input.** Every handler re-validates:
  categories and semesters against `src/constants.js`, ids against the real rows.
  Nothing is passed through to SQL on the model's say-so.
- **Scholar-role callers are pinned to their own `scholar_key`** inside each handler,
  from the verified token's `user_profile` row — never from `args.scholar`. This
  mirrors what the equivalent `app/api/**` route does; when you add a tool touching a
  scholar-scoped table, carry the `and scholar = <own key>` clause the same way.

**When you add a manual operation, add the matching tool.** The registry is the
parity contract — a new write endpoint without a tool entry silently makes the two
surfaces diverge again. Tools that write to expenses must derive `bucket` from
`CAT_TO_BUCKET` (see the `EXPENSE_CATS` rule below — same corruption risk).

Surfaces: the mentor console routes non-expense change requests to it (`agent`
intent in `NavigatorAIConsole.jsx`, also selectable manually); `ScholarChatPanel.jsx`
uses it as its primary path on all scholar pages, falling back to the older
unauthenticated `/api/ask-scholar` only on 401/503. Existing expense ingest/bulk-edit
flows keep their purpose-built review cards and are unchanged.

## Immersion hours integration (2026-07-06)

The mentor's Navigator "English" section (`src/components/EnglishSection.jsx`,
`GET /api/immersion-hours`) shows **live** hours/status pulled directly from
NextGen Immersion (`jonncy18-maker/NextGen-Immersion`,
https://next-gen-immersion.vercel.app/) — a completely separate app with its
own Neon project (`silent-cherry-49841538`, "NGS - Immersion") and its own
Neon Auth account system. There is no shared login, scholar key, or user ID
between the two apps.

- **Read path only, no writes.** `IMMERSION_DATABASE_URL` connects as a
  dedicated `ngs_scholars_reader` Postgres role in Immersion's database,
  created specifically for this — `GRANT SELECT` on exactly three objects
  (`scholar_pace`, `user_total_hours`, `users`), nothing else. It cannot
  write, and cannot read Immersion's session-logging tables, video catalog,
  or anything unrelated to hours. No RLS exists on Immersion's schema, so
  the plain GRANT is sufficient — no policies or `BYPASSRLS` needed.
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
- **`scholar_pace`'s numeric columns come back as strings** from Neon,
  same gotcha as `grade_entries` — coerced with `Number(...)` in the API
  route, not left to the client.
- If a new scholar joins Immersion, add their `IMMERSION_USER_ID` entry by
  querying `select id, scholar_name from users where role = 'scholar'` in
  the Immersion Neon project (readable via the same `ngs_scholars_reader`
  role) and asking the owner which row is which person.

## Key Rules for Claude Code

- **`EXPENSE_CATS` has exactly one home: `src/constants.js`.** Both `lib/ai/expense-edit.js`
  and `lib/ai/tier3.js` used to carry their own copy listing 12 of the 21 categories,
  missing every travel and milestone one. In `expense-edit.js` that silently rewrote any
  travel expense the mentor edited to `Other`/`college` (it coerces against the list),
  corrupting the bucket totals the public profile pages publish; in `tier3.js` it left
  Gemini no correct category to pick when ingesting a flight or hotel receipt. Both now
  import the shared list — never re-inline it.
- **Two money ledgers, never summed (2026-08, PR #243).** `expenses` + `budgets` are the
  *program's* money: what the scholarship spends on a scholar, and its per-semester plan.
  `living_category` / `living_plan` / `allowance` (`db/living_budget.sql`, backing
  `/budget/:scholar`) are the *scholar's own* money: her allowance and how she chooses to
  spend it. The allowance is **one** row in `expenses` (`Living Expenses` / `life`) and
  simultaneously the **entire income line** on her side — so summing her line items into
  `expenses` as well double-counts every peso and inflates the bucket totals
  `app/api/public/profile/[key]` publishes. `allowance.expense_id` is the only join between
  the two. Likewise `EXPENSE_CATS` are the mentor's sponsor categories and have nothing to
  do with her categories, which are user-defined rows, not a constant. `BudgetSection.jsx`
  and the `budgets` table remain the *program* budget — don't repurpose either.
- **`scholars-data.js` narrative drift** — it is the source of truth for narrative/profile
  fields. Profile pages merge Neon operational data on top at runtime. Keep
  `publicProfile` blocks in sync with any Neon-controlled fields (e.g. `currentSem`,
  GPA) referenced in the static copy.
- **`app/api/ask-scholar/route.js` is unauthenticated by design** and trusts a
  client-supplied `scholar` key — this matches the pre-migration Supabase Edge
  Function's behavior exactly, not a regression introduced by the port. Accepted
  risk for now; do not store sensitive PII before real scholar-scoped auth is
  extended to this route. Since 2026-07-25 it and `ask-public` are rate-limited
  per IP and body-size capped (`lib/rate-limit.js`) so an anonymous caller can't
  burn the Gemini quota — that bounds *cost*, not *access*: the scholar key is
  still trusted, so the PII caveat above stands unchanged.
- **Stale "Sheets" vocabulary removed (2026-07-12).** State/props/CSS that dated back
  to the pre-Supabase Google Sheets backend (`sheetsStatus`, `SHEETS_LABEL`,
  `sheets-pill`/`sheets-live`/etc. CSS classes, `sheetsOverrides`, `sheetsEvents`) were
  renamed to reflect the actual Neon backend (`connStatus`, `CONN_LABEL`, `conn-pill`
  CSS classes, `deadlineOverrides`, `dbEvents`) across `navigator.jsx`, `NavBar.jsx`,
  `NavFooter.jsx`, `DeadlinesSection.jsx`, `DataContext.jsx`, and `navigator.css`. No
  remaining references to Google Sheets anywhere in the codebase.
- **Doc cleanup pass (2026-07-05) done.** `README.md` was rewritten for the
  current Next.js/Neon architecture (routes, source layout, data flow all
  updated). `ROADMAP.md` and `ROADMAP-AI.md` had their still-"pending"-looking
  sections (Security audit follow-ups, Accepted risks, RLS hardening,
  Documents/Drive steps, the `ask` edge-function-deploy notes) corrected to
  reflect what Phase 5 actually resolved, dropped, or made moot — the
  chronological Phase 1–5 history itself was left intact as accurate record.
  `docs/SPA-MIGRATION-ROADMAP.md` got a superseded banner (its plan was
  replaced wholesale by the Next.js App Router cutover, never executed as
  written) but the file is kept for historical context.
- **Neon Auth `trusted_origins` must list every production alias.** Vercel
  generates multiple hostnames for one production deployment (e.g. the
  `jonncy18` domain, a random `-steel`-style alias, and the `git-main-jonncy18`
  branch alias) — Better Auth rejects sign-in from any origin not on the
  allowlist, and `LockScreen.jsx`/`ScholarAuthGate.jsx` show a generic
  "Incorrect credentials" for that rejection, indistinguishable from a real
  wrong password. If login fails on a URL that otherwise resolves to the
  correct production deployment, check `mcp__Neon__get_neon_auth_config`'s
  `trusted_origins` before assuming the password is wrong; add the missing
  origin with `mcp__Neon__configure_neon_auth` (`add_trusted_origin`) — takes
  effect immediately, no redeploy needed. Hit and fixed 2026-07-04 for the
  `-steel` and `git-main-jonncy18` aliases (and again for a PR preview alias
  while debugging the bug below — preview URLs need this too, not just the
  three long-lived production aliases).
- **Every scholar screen's data-fetch effect must gate on `authed`, not just
  the render.** `EnglishTracking`, `GradeEntry`, `VacationTracker`, and
  `MilestonesTracker` all do `if (!authed) return; ...` inside their data
  effects (with `authed` in the deps array) — `ScholarHome` was missing this
  and it caused a real bug (2026-07-04, PR #187, six iterations to root-cause):
  React fires effects on mount regardless of what the component *renders*, so
  a fetch effect gated only by `if (!authed) return <ScholarAuthGate/>` in the
  JSX still runs immediately, using whatever session cookie the browser
  already has — i.e. the *previous* scholar's, if the user navigated straight
  from one scholar's dashboard to another's login without signing out. That
  fetch's (wrong) response gets cached in state; signing in then unlocks the
  dashboard onto the stale data, and nothing re-fetches since `authed`
  wasn't a dependency. Symptom: a scholar's dashboard shows a *different*
  scholar's numbers until a manual refresh. The tell in DevTools is the
  `bootstrap` request firing *before* the sign-in's own request. Any new
  scholar-facing screen needs this same guard.
- **API responses must set their own `Cache-Control`.** Found alongside the
  bug above (a real issue, though not this bug's actual cause): Next.js App
  Router route handlers default to a *shareable* `Cache-Control: public,
  max-age=0, must-revalidate` with no `Vary: Authorization` when a response
  doesn't set its own cache header — verified live via
  `mcp__Vercel__web_fetch_vercel_url`. `lib/http.js`'s `json()` now sends
  `Cache-Control: private, no-store` on every response for this reason; keep
  using `json()` for all `app/api/**` responses rather than a raw
  `new Response(...)` so this stays covered.
- **Neon driver queries MUST opt out of Next's Data Cache** (root cause of the
  2026-07-12 "mentor dashboard frozen at an old expense snapshot" bug). The
  `@neondatabase/serverless` HTTP driver sends every query as a POST through
  global `fetch`, which Next.js patches with the Vercel Data Cache — and in
  Next 14 route handlers `export const dynamic = 'force-dynamic'` did **not**
  opt those fetches out (it sets `forceDynamic` but never `revalidate = 0`,
  which the POST/auth-header escape hatch in `patch-fetch.js` checks). Result:
  byte-identical query bodies like bootstrap's `select * from expenses` were
  cached with a one-year TTL, persisting across requests *and deploys*, while
  writes (whose bodies differ) landed fine — reads frozen, Neon console/MCP
  fresh. Fix: `neon(url, { fetchOptions: { cache: 'no-store' } })` in
  `lib/db.js` and `lib/immersion-db.js`. Any future direct `neon(...)` client
  or hand-rolled `fetch` from a route handler needs the same
  `cache: 'no-store'`. Verified by local repro: a POST fetch from a
  `force-dynamic` GET route handler served the same cached body on every
  request until `no-store` was added. The same rule was applied to the AI
  layer's hand-rolled Gemini `fetch` calls (`app/api/{ask-public,ask-scholar}`,
  `lib/ai/{tier2,tier3,action}.js`) — same POST-cached-by-url+body footgun,
  lower-risk there only because the prompt body varies per request, but now
  explicitly `cache: 'no-store'` so a cached AI response can't reflect a stale
  DB-context snapshot.

## Working in this environment

- **Commits:** GPG signing fails here — commit with
  `git -c commit.gpgsign=false commit -m "..."`.
- **Push:** uses the owner's fine-grained PAT (Contents: write). The token is
  NOT stored in the repo — never commit secrets.
- **GitHub Pages:** now a frozen redirect stub (`gh-pages-redirect/`), not the
  live app. After changes to it, the Fastly CDN can lag — hard-refresh
  (Cmd/Ctrl+Shift+R) before assuming a redirect fix didn't work.
- **Browser cache:** after a Vercel deploy, a normal reload often serves the old
  file. Tell the user to **hard-refresh** (Cmd/Ctrl+Shift+R).
- **Verifying behavior:** headless Chromium is available —
  `node` + `/opt/node22/lib/node_modules/playwright` (CommonJS `require`) +
  executablePath `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

### Working with Neon/Vercel

- **Neon project:** `patient-flower-81986836` ("NGS") — the live production
  database. The Supabase project (`rhoxpfuephkuaartuqou`) is fully
  decommissioned (Phase D) and was **paused on 2026-07-04** — nothing in this
  repo reads or writes to it anymore. Data is retained and the project is
  restorable from the Supabase dashboard if ever needed.
- **Vercel project:** `next-gen-scholars` (team `jonncy18`) — separate from the
  owner's unrelated `next-gen-immersion` project; don't confuse the two.
- **Vercel Deployment Protection** ("Vercel Authentication") must be disabled
  for headless/automated testing of preview deployments — otherwise API routes
  302-redirect to `vercel.com/sso-api` even via `web_fetch_vercel_url`. Only one
  protection level exists on the free tier (no scoped bypass token available).
  `mcp__Vercel__web_fetch_vercel_url` can reach protected/production deployments
  when direct `curl`/`WebFetch` calls 403 from this sandbox's network policy.
- **Connection strings are never fetched into the transcript** — Claude Code's
  safety classifier blocks `mcp__Neon__get_connection_string`. Guide the human
  to copy it manually from the Neon console into Vercel's env var UI instead.
- **`mcp__Neon__run_sql` is one-statement-per-call** (Postgres extended query
  protocol restriction) — DDL/DML with multiple `;`-separated statements, or
  dollar-quoted function bodies via `prepare_database_migration`, must be split
  into individual calls.
- **The sandbox cannot reach the Neon Auth domain, GitHub Pages, or the Vercel
  app domain directly** (network policy) — Better Auth sign-in/JWT flows must be
  tested live in the human's own browser; use `mcp__Vercel__web_fetch_vercel_url`
  for automated checks against deployed Vercel URLs instead of `curl`/`WebFetch`.

## Coder Profile & Agentic Loop

Two layers, both read in full at the start of each session.

Profile: https://raw.githubusercontent.com/jonncy18-maker/agentic-loop/main/CODER_PROFILE.md
Applies to **every task, with no threshold** — governs how code is written and how it
gets verified (root rule: anything not verified by execution is unverified, and gets
reported as unverified).

Protocol: https://raw.githubusercontent.com/jonncy18-maker/agentic-loop/main/AGENTIC_LOOP.md
(orchestrator: `orchestrator.js` in the same repo). Governs whether the right thing was
built. Activate for any change touching 3+ files, a new component/module, the data
layer, or with user-visible behavior, or estimated at more than ~5 minutes of
work — otherwise (typo, one-liner, single-file config change) just do it directly.
A change small enough to skip the loop is still governed by the profile.

## Wide-screen layout

`ScholarHome` (`src/styles/scholar-home.css`) and the expense-entry page
(`src/styles/entry.css`) switch to a two-column CSS grid layout at
`min-width: 1200px` (`grid-template-areas`, no JSX changes needed) — below
that they're the original single centered column. On `ScholarHome` the AI
chat panel becomes a sticky right rail next to the action cards/trackers; on
the entry page, chat/form/receipt-upload sit in a left rail next to the
pending-review list and expense table. The breakpoint was originally 1440px
but was lowered to 1200px (PR #186) since 1440px didn't reliably trigger on
real laptop displays once OS display scaling / browser zoom reduces the
effective CSS viewport width below the physical resolution.

## Native app (PWA → Play Store) — PLANNED

Part of the NGS native rollout: ship as an installable Android app (PWA wrapped
in a TWA) on the Play **Internal Testing** track (private — mentor + scholars
install by email allowlist). Nothing built yet. **NextGen-Immersion is the
pilot** — prove the pipeline there first, then follow here.

- **`docs/PWA.md`** — installable-PWA groundwork (manifest, service worker,
  icons). Critical repo-specific rule: the service worker must keep **`/api/**`
  strictly network-only** and must **never cache scholar-scoped responses**
  (`/api/bootstrap` etc.) — caching them would reintroduce the "one scholar
  sees another scholar's numbers" bug class documented above.
- **Play Store step:** copy NextGen-Immersion's `docs/PLAY-STORE.md` here after
  the pilot proves out (adapt origin + a new package id).

See `ROADMAP.md` for status.

## Conventions

- Match the existing inline style of each file (token-based CSS vars `--ngs-*`,
  Newsreader/Manrope/IBM Plex Mono fonts, navy + gold palette).
- Keep internal navigation within the app using Next.js `<Link>` (`next/link`)
  and `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`) — not
  `react-router-dom`, which was removed in the Phase A′ migration.
- Only commit/push when asked. Use `git -c commit.gpgsign=false`.
