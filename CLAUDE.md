# SS Badminton Club app

Mobile-first PWA for a Malaysian badminton club: players RSVP to sessions, pay from
a wallet (RM), record matches and climb a monthly leaderboard. Hosts/admins run
sessions and finances.

> README.md is out of date (it describes an older Next.js/NextAuth version). Trust this
> file and the code.

## Stack

- TanStack Start (React 19, TanStack Router file routes in `src/routes`, server
  functions via `createServerFn`), TanStack Query
- Drizzle ORM on Supabase Postgres (`src/db/schema.ts`); Supabase Auth (JWT verified in
  `src/middleware/auth.ts`); Web Push via `web-push` (`src/lib/push.ts`)
- Tailwind v4 + shadcn/ui (`src/components/ui`), `sonner` toasts, `lucide-react` icons
- pnpm. `pnpm dev`, `pnpm lint` (oxlint), `pnpm format` (oxfmt). `tsc` has many
  pre-existing errors, so check only the files you touched.

## Layout

- `src/features/<area>/server.ts`: server functions + `queryOptions` for that area
- `src/features/<area>/*.tsx`: that area's UI
- `src/routes/_app/*`: player-facing pages (bottom nav: Sessions · Leaderboard ·
  Wallet, + Admin for admins). `src/routes/_console/*`: admin console.
- Roles: `PLAYER`, `HOST` (runs own sessions), `ADMIN` (everything)
- **Look up files in `docs/map.md`** (every page, server function and shared helper)
  before grepping. Env vars: `docs/env.md`.

## Conventions

- Mutations return `Result<T>` (`src/lib/guards.ts`): `SUCCESS | AUTH_ERROR |
FORBIDDEN | NOT_FOUND | BUSINESS_ERROR{code}`; the UI shows `code` in a toast.
- Validate inputs with zod schemas in `src/lib/validations.ts`.
- **Server-only code must not leak into the browser bundle.** Server-function bodies
  are stripped from the client, but plain helpers in the same file are not. Keep
  helpers that touch `db`, `web-push` etc. in separate modules imported only inside
  handlers (e.g. `src/lib/guards.ts`, `src/features/matches/queries.ts`).
- Times are stored as UTC in `timestamp` columns; the club runs on Malaysia time (UTC+8).
- Design: soft pink brand (`#ffcff2`, magenta foreground), black header, Inter only.
  Keep it restrained: a bolder hot-pink / display-font pass was rejected. Animations
  live in `src/styles/globals.css` and must respect `prefers-reduced-motion`.

## Database changes

1. Edit `src/db/schema.ts`, then `pnpm db:generate` to write `drizzle/NNNN_*.sql`.
2. The live database does **not** track applied migrations (no `drizzle` schema). Apply
   the new SQL file yourself in one transaction (strip `--> statement-breakpoint`,
   `psql --single-transaction -v ON_ERROR_STOP=1`), after the owner says yes. Avoid
   `db:push` against live: it diffs the whole schema.
3. `DATABASE_URL` in `.env` is the **live** Supabase. For experiments use a throwaway
   local Postgres instead.
4. Record it in `drizzle/APPLIED.md`, which is also where to look for "has migration N run?".

## Testing (Playwright)

- `pnpm test:e2e` (or `test:e2e:ui`). Global setup drops and rebuilds the local
  `badminton_test` DB (Homebrew Postgres, `TEST_DATABASE_URL` to override) from
  `schema.ts` via `drizzle-kit push`, seeds it (`e2e/seed.ts`), and starts its own dev
  server on :3100 with `DATABASE_URL` pointed there. `pnpm test:db:reset` does just the DB.
- Every test starts from a fresh seed (tables truncated and re-seeded before each test),
  so tests can change data freely. `e2e/seed.ts` documents the seeded users
  (`SEED_USERS`), sessions (`SEED_SESSIONS`: upcoming, full, late, finished, live) and
  balances; tests import those constants rather than hard-coding them. Seeded ids stay
  alphanumeric: the session route strips anything after a `-` as pasted-link junk.
- Sign in with the `loginAs(user)` fixture (`e2e/fixtures.ts`): it mints an HS256 token
  that `verifyAccessToken` accepts only when `E2E_AUTH_SECRET` is set and `NODE_ENV` isn't
  production. Never set that variable anywhere real. Calling it again opens a separate
  browser for a second user (e.g. player asks, admin approves). `page.goto`/`reload` wait
  for React to hydrate, since clicks before that are lost.

## Seeing the app

Use the `preview` skill: `pnpm dev:test` (test DB on :3200, background) then
`pnpm -s shot /sessions --as player` → `.context/shots/*.png`. Don't start `pnpm dev`
on other ports or write throwaway Playwright scripts to look at a page. Plain `pnpm dev`
talks to the **live** DB, and you can't sign in to it from a script.

To click around by hand: `pnpm dev:local` (own DB `badminton_dev`, kept between runs, :3201+;
`--reset` reseeds, `--host` for a phone). Open `/api/dev-login`: it lists
the DB's people, and picking one sets the test token cookie (7 days). It 404s unless
`E2E_AUTH_SECRET` is set and `NODE_ENV` isn't production, so only `dev:test` / `dev:local` have it.

## Working across sessions

Several Claude sessions often run in this workspace at once, and they share `.context/`.

- `.context/backlog.md` holds numbered work items ("do 4" refers to these). Claim an item
  (status + files) before editing code for it, skip anything overlapping another claim,
  and mark it done with the commit.
- Before editing a file, check `git status`/`git diff` on it. Uncommitted changes there
  may be another session's: build on them, don't overwrite or revert them.
- Pick up from `.context/handoff/<topic>.md` notes, not full transcripts. The `handoff`
  skill writes those and backlog items.

## Keeping docs current

Before you finish a task, if you had to discover something the hard way (a gotcha, a file
location, a product rule, the user's preference), add one line to where the next session
will look: this file for commands/gotchas/taste, `docs/<feature>.md` for how a feature
works, `.claude/skills/preview` for running the app. Fix stale lines instead of appending.
Keep this file under ~120 lines; move detail into `docs/`. Commit doc edits with the change.

## Gotchas

- The shell is zsh: quote globs in flags (`grep -rn foo src --include='*.tsx'`), or
  they fail with "no matches found".
- Run local tools via pnpm (`pnpm exec tsx`, `pnpm exec playwright`); none are global.
  Missing browser → `pnpm exec playwright install chromium`.
- `pnpm test:e2e` rebuilds `badminton_test`, which another workspace's `dev:test` server (:3200) may be using. Use your own throwaway DB: first `TEST_DATABASE_URL=postgres://localhost:5432/badminton_test_<name> pnpm test:db:reset` (creates it; without it the web server 500s and you get a 120s timeout), then run the tests with the same variable. A first run can also time out while Vite warms up; rerun.
- Guests (`users.isGuest`) must be excluded from member lists, and ledger totals per player key on `guestId ?? userId`. See `docs/sessions.md`.
- `psql` is `/opt/homebrew/opt/postgresql@14/bin/psql`, which may not be on PATH.
- `package.json` overrides `nitro>srvx` to 0.11: srvx 0.8 (Nitro 3.0.0) aborts requests
  once the body is read, so server-function POSTs 500'd in `vite dev`. Drop it when Nitro bumps.
- The dev log's `import-protection` warning about `src/middleware/auth.ts` is known and
  harmless (see the comment there). Don't chase it.

- Auth: `sessionMiddleware` caches the session lookup per request (WeakMap on the `Request`), so
  one SSR page load does at most 1 Supabase refresh. Don't call `getCookie` for the token elsewhere.
- Timing the app: `.context/perf/` (`serve.sh`, `bench.ts`) runs a prod build with a 200 ms-delayed
  local DB and a fake Supabase refresh endpoint. Build it with `NODE_ENV=test pnpm build`, since a
  normal build inlines production and disables the test-token sign-in.

## Feature docs (rules + decision logs)

- Sessions, deposits, waitlist, late cancels, finalize: `docs/sessions.md`
- Matches, monthly leaderboard & attendance tab: `docs/matches.md`
- Badges (profile medals + leaderboard tags, nothing stored): `docs/badges.md`
- Google Sheet finance log (approvals → Sheet, Apps Script setup): `docs/google-sheet.md`
