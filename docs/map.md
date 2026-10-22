# Codebase map

Where things live, so you can open the right file instead of grepping. Paths are from
`src/`. If you move or rename something listed here, update this file in the same change.

## Pages → files

Player app (`routes/_app.tsx` is the shell: header, bottom nav, PWA install card).

| URL                        | Route file                                     | Main pieces                                                                                                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                        | `routes/index.tsx`                             | redirects to `/sessions`                                                                                                                                                                                                                                        |
| `/sessions`                | `routes/_app/sessions.tsx`                     | `components/session-card.tsx` (card + quick Join, login prompt)                                                                                                                                                                                                 |
| `/sessions/:id`            | `routes/_app/sessions_.$id.tsx`                | `features/sessions/rsvp-buttons.tsx` (bottom join/leave/top-up button), `features/sessions/roster-manage.tsx` (host tools), `features/matches/session-matches.tsx`, `features/admin/lock-session-form.tsx` (Finalize), `features/admin/edit-session-toggle.tsx` |
| `/sessions/:id/<junk>`     | `routes/_app/sessions_.$id.$.tsx`              | redirects mangled shared links to the clean URL                                                                                                                                                                                                                 |
| `/sessions/new`            | `routes/_app/sessions_.new.tsx`                | `features/admin/session-form.tsx` (hosts create here)                                                                                                                                                                                                           |
| `/leaderboard`             | `routes/_app/leaderboard.tsx`                  | `features/matches/leaderboard.tsx`                                                                                                                                                                                                                              |
| `/wallet`                  | `routes/_app/wallet.tsx`                       | `features/topup/topup-dialog.tsx`, `features/withdrawal/withdrawal-dialog.tsx`                                                                                                                                                                                  |
| `/topup`                   | `routes/_app/topup.tsx`                        | redirects to `/wallet`                                                                                                                                                                                                                                          |
| `/profile`                 | `routes/_app/profile.tsx`                      | `features/profile/streak-card.tsx`, `phone-form.tsx`, `notification-toggle.tsx`, `features/auth/sign-out-button.tsx`                                                                                                                                                               |
| `/login`, `/auth/callback` | `routes/login.tsx`, `routes/auth/callback.tsx` | `features/auth/login-buttons.tsx` (Google via Supabase)                                                                                                                                                                                                         |

Admin console (`routes/_console.tsx` is the shell, `components/console-nav.tsx`; ADMIN only).
There is no `/admin` index page.

| URL                                    | Route file                                | Main pieces                                                                                                            |
| -------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/admin/sessions`                      | `routes/_console/admin/sessions.tsx`      | `features/admin/session-list.tsx`                                                                                      |
| `/admin/sessions/:id`                  | `routes/_console/admin/sessions_.$id.tsx` | `add-player-form`, `session-actions-menu` (⋯: copy link, duplicate, delete), `lock-session-form`, `features/sessions/roster-manage.tsx` |
| `/admin/sessions/new`                  | `routes/_console/admin/sessions_.new.tsx` | `features/admin/session-form.tsx` (same form as hosts)                                                                 |
| `/admin/topups`                        | `routes/_console/admin/topups.tsx`        | `features/admin/topup-actions.tsx`, `features/finance/withdrawal-actions.tsx` (top-ups **and** withdrawals)            |
| `/admin/finance`                       | `routes/_console/admin/finance.tsx`       | `features/finance/*` (expenses, cash flow, summary)                                                                    |
| `/admin/members`, `/admin/members/:id` | `routes/_console/admin/members*.tsx`      | `features/members/adjust-balance-dialog.tsx`                                                                           |

API routes (`routes/api/`): `upload.ts` (receipt upload, 2 MB photos, to the private
`receipts` bucket), `receipts.$id.ts` (admin "View receipt" → 60 s signed link),
`admin/export.ts` (CSV), `cron/cleanup-receipts.ts` (daily, deletes receipts > 60 days;
see `vercel.json`). Receipt rules: `features/topup/receipt.ts`.

## Server functions (`features/<area>/server.ts`)

| Area         | Functions                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessions`   | `fetchSessionsFn`, `fetchSessionDetailFn`, `rsvpFn` (join / waitlist / leave / late-cancel request), `withdrawLateCancelFn`                                                                                                                                                                                                                                                                                         |
| `admin`      | courts (`fetchCourtsFn`, `createCourtFn`, `deleteCourtFn`), sessions (`createAdminSessionFn`, `updateAdminSessionFn`, `deleteSessionFn`, `lockSessionFn` = Finalize, `fetchSessionTemplateFn` = prefill/duplicate), roster (`addPlayerFn`, `removePlayerFn`, `resolveLateCancelFn`, `promoteWaitlistFn`), top-ups (`fetchAdminTopUpsFn`, `confirmTopUpFn`, `rejectTopUpFn`), `fetchMembersFn`, `fetchMemberNamesFn` |
| `matches`    | `fetchSessionMatchesFn`, `fetchLeaderboardFn`, `createMatchFn`, `submitMatchResultFn`, `respondToMatchFn`, `deleteMatchFn`                                                                                                                                                                                                                                                                                          |
| `topup`      | `fetchTopUpsFn`, `createTopUpFn`                                                                                                                                                                                                                                                                                                                                                                                    |
| `withdrawal` | `fetchWithdrawalsFn`, `fetchWithdrawableFn`, `fetchSavedPaymentDetailsFn`, `createWithdrawalFn`, `fetchAdminWithdrawalsFn`, `confirmWithdrawalFn`, `rejectWithdrawalFn`                                                                                                                                                                                                                                             |
| `wallet`     | `fetchWalletFn`                                                                                                                                                                                                                                                                                                                                                                                                     |
| `finance`    | expenses CRUD + `markExpensePaidFn` / `markExpenseReimbursedFn`, `createManualAdjustFn`, `fetchFinanceSummaryFn`, `fetchCashFlowFn`                                                                                                                                                                                                                                                                                 |
| `members`    | `fetchMemberDirectoryFn`, `fetchMemberDetailFn`, `setMemberRoleFn` (player ↔ host)                                                                                                                                                                                                                                                                                                                                                                     |
| `profile`    | `fetchProfileFn`, `fetchPlayedDaysFn`, `savePushSubscriptionFn`, `clearPushSubscriptionFn`, `updatePhoneFn`                                                                                                                                                                                                                                                                                                                              |
| `auth`       | `createSessionFn` (sets auth cookies), `signOutFn`, `fetchCurrentUserFn`                                                                                                                                                                                                                                                                                                                                            |

Each has a matching `xxxQueryOptions`. Zod schemas for every mutation are in `lib/validations.ts`.

## Shared logic (no UI)

| File                                 | What                                                                                   | Bundle          |
| ------------------------------------ | -------------------------------------------------------------------------------------- | --------------- |
| `features/sessions/rules.ts`         | `LATE_CANCEL_WINDOW_MS`, `isLateCancel`, `waitlistOrder`, `canManageSession`           | client-safe     |
| `features/sessions/roster.ts`        | `takeDeposit`, `refundDeposit`, `heldDeposit`, `promoteFromWaitlist`, `approverTokens` | **server-only** |
| `features/profile/streak.ts`         | weekly streak maths, month calendar grid (Malaysia days, Mon–Sun weeks) | client-safe     |
| `features/matches/logic.ts`          | match states, score rules, month helpers, `buildStandings`                             | client-safe     |
| `features/matches/queries.ts`        | match loading, push targets                                                            | **server-only** |
| `features/admin/session-template.ts` | `templateFromSession` (prefill for new sessions)                                       | client-safe     |
| `features/finance/format.ts`         | `computeFinanceSummary`, expense labels                                                | client-safe     |
| `lib/guards.ts`                      | `Result<T>`, `requireAdmin`                                                            | server-only     |
| `lib/wallet.ts`                      | `adjustBalance` (atomic ± balance), `lockSession` (serializes roster changes)          | server-only     |
| `lib/push.ts` / `lib/push-client.ts` | every `send…Notification` / browser subscribe                                          | server / client |
| `lib/google-sheet.ts`                | append approved top-ups/withdrawals to the Sheet                                       | server-only     |
| `lib/supabase.ts`                    | receipt upload / signed link / delete                                                 | server-only     |
| `lib/utils.ts`                       | `cn`, `CLUB_TIME_ZONE`, `formatCurrency`, `formatDate(Time)`                           | client-safe     |
| `lib/phone.ts`                       | `whatsAppLink` (host contact)                                                          | client-safe     |
| `middleware/auth.ts`                 | `sessionMiddleware`, `verifyAccessToken` (Supabase JWKS, or the e2e secret)            | both            |

`lib/supabase-server.ts` and `lib/supabase-client.ts` are unused leftovers from the
Next.js version.

## Shared UI

- `features/sessions/roster-manage.tsx`: `LateCancelRequests`, `WaitlistPanel`,
  `AddWalkInButton`, `RemovePlayerDialog`. Used by both the session page and the console.
- `features/matches/controls.tsx`: `PersonAvatar`, `AvatarStack`, `ScoreStepper`, `Segmented`.
- `components/copy-icon.tsx`: copy → tick icon. `features/sessions/join-celebration.tsx`: join burst.
- `components/ui/*`: shadcn. Toasts are `sonner` (`components/ui/sonner.tsx`).

## Data (`db/schema.ts`)

`users` (role, `balance`, `fcmToken` = push subscription, phone) · `sessions` (`minBalance` =
deposit, `status` OPEN/LOCKED) · `attendances` (YES/NO/WAITLIST + late-cancel fields) ·
`ledger` (every wallet movement, typed) · `top_up_requests`, `withdrawal_requests` ·
`expenses` (real cash out, separate from wallets) · `courts` (saved venues) · `matches`,
`match_players` · `settings`.

Feature rules: `docs/sessions.md` (sessions, deposits, waitlist, late cancels) and
`docs/matches.md` (matches, leaderboard).
