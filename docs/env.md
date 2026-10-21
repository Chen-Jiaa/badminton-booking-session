# Environment variables

Set in `.env` locally and in the Vercel project (Production + Preview). `VITE_*` are
baked into the browser bundle, so never put a secret there. Local `.env` points
`DATABASE_URL` at the **live** DB. `pnpm dev:test` / `pnpm test:e2e` override it with
the local test DB.

| Variable                                                 | Used by                                                                | Needed for                                                                                                                                                                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                           | `db/index.ts`, `drizzle.config.ts`                                     | everything (Supabase Postgres)                                                                                                                                                                                             |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`            | `features/auth/*`, `middleware/auth.ts` (JWKS), `routes/api/upload.ts` | Google sign-in, verifying tokens                                                                                                                                                                                           |
| `SUPABASE_SERVICE_ROLE_KEY`                              | `lib/supabase.ts` (server only)                                        | receipt upload, admin "View receipt" (signed links) and the daily cleanup, in the private `receipts` bucket. **Secret**: bypasses all Supabase access rules. Blanked for test servers so tests never write to live Storage |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `lib/push.ts`                                                          | sending Web Push (top-up approved, match invites, waitlist promotion…). Generate with `npx web-push generate-vapid-keys`                                                                                                   |
| `VITE_VAPID_PUBLIC_KEY`                                  | `lib/push-client.ts`                                                   | the browser subscribing to push. Same value as `VAPID_PUBLIC_KEY`                                                                                                                                                          |
| `CRON_SECRET`                                            | `routes/api/cron/cleanup-receipts.ts`                                  | Vercel Cron auth (`vercel.json`, daily). If unset the cron endpoint refuses every call                                                                                                                                     |
| `GOOGLE_SHEET_WEBHOOK_URL`                               | `lib/google-sheet.ts`                                                  | finance log to the Sheet. Empty = off. See `docs/google-sheet.md`                                                                                                                                                          |
| `E2E_AUTH_SECRET`                                        | `middleware/auth.ts`                                                   | tests only. Hard-coded in `e2e/env.ts` and passed by the test servers. **Never set it in `.env` or on Vercel**                                                                                                             |
| `TEST_DATABASE_URL`                                      | `e2e/env.ts`                                                           | optional override of `postgres://localhost:5432/badminton_test`                                                                                                                                                            |

Unused leftovers (safe to delete from `.env` / Vercel): `AUTH_SECRET`, `BYPASS_AUTH`
(NextAuth era, which is why "BYPASS_AUTH=true" does nothing), `NEXT_PUBLIC_SUPABASE_*`,
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

## Local dev server (click around by hand)

`pnpm dev:local` runs the app against its own local database, `badminton_dev`, and never
touches live Supabase.

| Command                                                            | What it does                                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev:local`                                                   | Starts at **http://localhost:3201** (next free port if taken). Builds and seeds the DB only if it doesn't exist; keeps your data between runs    |
| `pnpm dev:local --reset`                                           | Wipes `badminton_dev` and reseeds it (local fake data only)                                                                                      |
| `pnpm dev:local --host`                                            | Also serves it on your Wi-Fi to open on a phone: `http://<Mac IP>:3201/api/dev-login`. Opt-in because anyone on the Wi-Fi could then pick a user |
| `DEV_DATABASE_URL=postgres://localhost:5432/<name> pnpm dev:local` | Use a different local database                                                                                                                   |

**Sign in:** open **http://localhost:3201/api/dev-login**, pick a seeded person
(`e2e/seed.ts`: Ada Admin is ADMIN, the rest PLAYER). It sets a test token cookie for
7 days. The route 404s unless `E2E_AUTH_SECRET` is set and `NODE_ENV` isn't production,
so it does nothing on Vercel and on plain `pnpm dev` (whose `.env` has no test secret and
points at the **live** DB). No `.env` changes are needed: the script passes everything.

The script blanks `GOOGLE_SHEET_WEBHOOK_URL` and `SUPABASE_SERVICE_ROLE_KEY` on purpose.
Left set (from `.env`), approving a top-up would write a row to the real finance Sheet and
a receipt upload would land in the real Storage bucket. So the Sheet log and receipt
upload are off locally.

`pnpm dev:test` (:3200) is the same idea for screenshots: it resets `badminton_test` on
every start, and `pnpm shot` signs in for you. Another workspace may already hold :3200.

## FAQ

- **Can't sign in on local `pnpm dev`.** Google sign-in goes through Supabase, whose
  allowed redirect URLs must include your local origin (Supabase → Authentication → URL
  Configuration). To look at pages as a user, use `pnpm dev:test` + `pnpm shot` instead
  (the `preview` skill).
- **Google's sign-in screen shows `<project>.supabase.co`, not the app name.** Google
  shows the OAuth redirect domain. Changing it needs a Supabase custom domain (paid
  add-on) or a verified app name on the Google Cloud OAuth consent screen.
