# NextGen Scholars — Project Context

Private mentorship-program website + mentor dashboard for a privately funded
program supporting Filipino nursing students (NGN track) on a pathway toward
licensure abroad (PH → OET → NCLEX → AHPRA Australia).

Shared project instructions for every coding agent (Claude Code, Codex, Antigravity). Each agent's role and permissions live in its own global file, not here.

> **Session start:** read `docs/ARCHITECTURE.md` (routes, file map, data flow, AI layer and MCP server detail) and the latest `ROADMAP.md` entry before making structural changes.

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
- **CI:** `.github/workflows/ci.yml` runs `npm ci` + `npm run build` on every PR to `main` (no test suite).

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
| `OPENAI_API_KEY` | none | Server only (`lib/ai/luna.js`, `app/api/luna-compare/route.js`) | OPTIONAL. GPT-6 Luna for expense ingestion (`tier3Ingest`, provider `'luna'`). Receipts and typed expense descriptions are sent to OpenAI when it is used. Same exposure risk as the other AI keys. |
| `NGS_MCP_TOKEN` | none | Server only (`lib/mcp-server.js`, `app/api/mcp/ngs/*`, `app/api/chatgpt/mcp`) | Bearer secret gating the mentor-role MCP server — full read/write access to every Tier 4 tool (`lib/ai/tools.js`). Never sent to the client; also doubles as the OAuth handshake's access/refresh token for claude.ai's connector (see "MCP server" below) — there is no second credential. |

**Rule:** anything that touches the Neon database directly or calls Gemini/Claude
runs only in `app/api/**` route handlers; the browser calls those routes,
never Neon, Gemini, or Claude directly. Never commit a value for any key — set
all of them in Vercel's project env vars only.

- **Security note:** the `password` in `scholars-data.js` is **cosmetic only**. The file
  is a public static asset — anyone can read it. Do not treat this as real access control
  (see ROADMAP "Accepted risks").

## AI layer

Architecture and history: `docs/ARCHITECTURE.md` → "AI layer". The rules that hold it together:

### Provider routing (2026-08-24) — Claude for signed-in accounts, Gemini for the public

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

### MCP server

`app/api/mcp/ngs` (and `app/api/chatgpt/mcp`) expose the Tier 4 registry to external clients as the mentor role, unscoped, gated by `NGS_MCP_TOKEN`. Read `docs/ARCHITECTURE.md` → "MCP server" before changing it.

## Immersion hours integration (2026-07-06)

Live hours come from the separate NextGen Immersion app's Neon project. Full detail (scholar mapping, which screens read it, adding a scholar): `docs/ARCHITECTURE.md` → "Immersion hours integration".

- **Read path only, no writes.** `IMMERSION_DATABASE_URL` connects as a
  dedicated `ngs_scholars_reader` Postgres role in Immersion's database,
  created specifically for this — `GRANT SELECT` on exactly three objects
  (`scholar_pace`, `user_total_hours`, `users`), nothing else. It cannot
  write, and cannot read Immersion's session-logging tables, video catalog,
  or anything unrelated to hours. No RLS exists on Immersion's schema, so
  the plain GRANT is sufficient — no policies or `BYPASSRLS` needed.

- **`scholar_pace`'s numeric columns come back as strings** from Neon,
  same gotcha as `grade_entries` — coerced with `Number(...)` in the API
  route, not left to the client.

## Key rules

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

- **Model IDs in code stay pinned.** `CLAUDE_MODEL` in `lib/ai/claude.js` (and the other model
  constants) are API arguments and stay pinned to an exact ID deliberately.

## Working in this environment

- **GitHub Pages:** now a frozen redirect stub (`gh-pages-redirect/`), not the
  live app. After changes to it, the Fastly CDN can lag — hard-refresh
  (Cmd/Ctrl+Shift+R) before assuming a redirect fix didn't work.
- **Browser cache:** after a Vercel deploy, a normal reload often serves the old
  file. Tell the user to **hard-refresh** (Cmd/Ctrl+Shift+R).

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

## Map and maintenance

Reference docs: `docs/ARCHITECTURE.md` (routes, files, data architecture, AI layer, MCP server, Immersion detail, wide-screen layout), `ROADMAP.md` (dated history, accepted risks), `ROADMAP-AI.md`, `docs/PWA.md`, `db/README.md`, `STACK_BLUEPRINT.md`. No `.claude/skills/` exist yet; if one is added, read `.claude/skills/<name>/SKILL.md` before changing that domain.

**Keep this file short — it is a maintenance rule.** Before adding anything, ask: does it change how code is written outside one domain? If it only matters in one domain, it goes in that domain's skill (`.claude/skills/<name>/SKILL.md`) or `docs/ARCHITECTURE.md`. A procedure John runs goes in `docs/`. A dated account of why a decision was made goes in `ROADMAP.md`. Anything only Claude Code needs goes in `CLAUDE.md`. State each rule once, and never put agent permissions (push, merge, deploy) here.
