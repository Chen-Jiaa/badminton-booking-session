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

## Testing (Playwright)

- `pnpm test:e2e` (or `test:e2e:ui`). Global setup drops and rebuilds the local
  `badminton_test` DB (Homebrew Postgres, `TEST_DATABASE_URL` to override) from
  `schema.ts` via `drizzle-kit push`, seeds it (`e2e/seed.ts`), and starts its own dev
  server on :3100 with `DATABASE_URL` pointed there. `pnpm test:db:reset` does just the DB.
- Every test starts from a fresh seed (tables truncated and re-seeded before each test),
  so tests can change data freely. `e2e/seed.ts` documents the seeded users
  (`SEED_USERS`), sessions (`SEED_SESSIONS`: upcoming, full, late, finished, live) and
  balances; tests import those constants rather than hard-coding them.
- Sign in with the `loginAs(user)` fixture (`e2e/fixtures.ts`): it mints an HS256 token
  that `verifyAccessToken` accepts only when `E2E_AUTH_SECRET` is set and `NODE_ENV` isn't
  production. Never set that variable anywhere real. Calling it again opens a separate
  browser for a second user (e.g. player asks, admin approves). `page.goto`/`reload` wait
  for React to hydrate, since clicks before that are lost.
- `package.json` overrides `nitro>srvx` to 0.11: Nitro 3.0.0's dev server ships srvx
  0.8, which aborts each request once its body is read, so every server-function POST
  saved its data but returned a 500 in `vite dev`. Drop the override once Nitro bumps srvx.

## Feature docs

- Matches & monthly leaderboard (how it works + decision log): `docs/matches.md`
- Google Sheet finance log (top-up / withdrawal approvals → Sheet, setup + Apps Script): `docs/google-sheet.md`
