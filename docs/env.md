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

## FAQ

- **Can't sign in on local `pnpm dev`.** Google sign-in goes through Supabase, whose
  allowed redirect URLs must include your local origin (Supabase → Authentication → URL
  Configuration). To look at pages as a user, use `pnpm dev:test` + `pnpm shot` instead
  (the `preview` skill).
- **Google's sign-in screen shows `<project>.supabase.co`, not the app name.** Google
  shows the OAuth redirect domain. Changing it needs a Supabase custom domain (paid
  add-on) or a verified app name on the Google Cloud OAuth consent screen.
