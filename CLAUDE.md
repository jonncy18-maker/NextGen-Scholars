@AGENTS.md

# Claude Code only

Everything shared with other agents is in `AGENTS.md` (imported above). This file holds what applies to Claude Code alone.

> **Personal context:** John maintains a dated personal-context doc (background,
> constraints, review priorities as the builder) in this Google Drive folder:
> https://drive.google.com/drive/folders/1cjNFhY6ZnN5xB4PSDhz7FA24KGl92NTy — titles
> are date-stamped (e.g. `Personal_Context_YYYY-MM-DD.md`). At session start, or
> whenever asked to review this repo "against what you know about me," use the
> Google Drive tools to find the **most recently dated** file in that folder (don't
> assume a fixed filename — a newer one may have been added) and weigh suggestions
> against it, not just generic best practice.

## Working in this environment

- **Commits:** GPG signing fails here — commit with
  `git -c commit.gpgsign=false commit -m "..."`.
- **Push:** uses the owner's fine-grained PAT (Contents: write). The token is
  NOT stored in the repo — never commit secrets.
- **Verifying behavior:** headless Chromium is available —
  `node` + `/opt/node22/lib/node_modules/playwright` (CommonJS `require`) +
  executablePath `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- Only commit/push when asked. Use `git -c commit.gpgsign=false`.

### Working with Neon/Vercel

- **`mcp__Neon__run_sql` is one-statement-per-call** (Postgres extended query
  protocol restriction) — DDL/DML with multiple `;`-separated statements, or
  dollar-quoted function bodies via `prepare_database_migration`, must be split
  into individual calls.
- **The sandbox cannot reach the Neon Auth domain, GitHub Pages, or the Vercel
  app domain directly** (network policy) — Better Auth sign-in/JWT flows must be
  tested live in the human's own browser; use `mcp__Vercel__web_fetch_vercel_url`
  for automated checks against deployed Vercel URLs instead of `curl`/`WebFetch`.

## Git workflow (set by John, 2026-10-03)

- Commit finished work to **local `main`**. A short-lived local branch merged into local `main` is fine.
- **Never push to GitHub or open a PR on your own.** Push a branch or open a PR only when John explicitly asks for that push in the conversation. Approving a fix is not approving a push.
- This overrides any older standing permission to push, open PRs or merge.
