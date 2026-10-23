# Sessions, deposits, waitlist and late cancellations

How a session works from creation to charging, and the product rules behind it. Code:
`features/sessions/{server,rules,roster}.ts` and the roster/session functions in
`features/admin/server.ts` (see `docs/map.md`).

## Who can do what

- **PLAYER**: join, waitlist, leave, ask for a late cancellation, record matches.
- **HOST**: everything a player can, plus create sessions (`/sessions/new`) and manage
  **their own** sessions from the session page: walk-ins, remove, waitlist, late cancels,
  edit, finalize, cancel (not after finalize).
- **ADMIN**: every session, plus the `/admin` console (money, members).
- `canManageSession(user, session)` in `rules.ts` is the single check for this. Use it
  rather than re-deriving roles.

## Lifecycle

1. **Create.** `createAdminSessionFn`. The form prefills from the host's last session, or
   from `?from=<id>` for Duplicate (`fetchSessionTemplateFn`, `session-template.ts`).
   Court cost (`courts × costPerCourt`) is recorded straight away as a paid
   `COURT_RENTAL` expense by the creator: they booked and paid upfront.
2. **RSVP** until `rsvpDeadline` (if set) and never after `startTime` (`rsvpFn`).
3. **Live** (start → end): the bottom button becomes "Record match" (`docs/matches.md`).
4. **Finalize** after `endTime` (`lockSessionFn`, "Finalize & Deduct", behind a confirm).
   It's blocked while any late cancellation is still PENDING.
   - `total = courts × costPerCourt + shuttleCost`; `costPerPlayer = total / confirmed players`.
   - Each confirmed player is charged `costPerPlayer − held deposit` (a negative result
     is refunded). Sets `status = LOCKED` and `attendances.finalCost`.
   - Shuttles become an expense only if someone supplied their own (`shuttleSupplierId`).
     Club stock was already expensed when it was bought.
   - A balance below RM 20 afterwards sends a low-balance push.
5. **Cancel/delete** (`deleteSessionFn`): reverses every ledger row for the session,
   soft-deletes unreimbursed expenses (reimbursed ones survive, unlinked), and deletes
   matches and attendances.

## Deposits (`minBalance`)

- Joining takes `minBalance` from the wallet as a `SESSION_DEPOSIT` ledger row.
  "Insufficient balance" turns the join button into "Top up RM x to join", which opens
  the top-up sheet prefilled.
- The amount held is always computed from the ledger (`heldDeposit`), never from the
  session's current `minBalance`. Editing the deposit later doesn't change what
  existing players get back.
- Refunds (`SESSION_REFUND`) happen on an early leave, an approved late cancel, or when
  a host removes the player.
- **Walk-ins** added by a host (`addPlayerFn`) pay no deposit and are charged the full
  share at finalize.

## Waitlist

- Only possible when the session is full. The player must have the deposit on hand
  but doesn't pay it until promoted.
- Order: oldest `waitlistedAt` first (`waitlistOrder`).
- When a spot frees up (early leave), `promoteFromWaitlist` moves in the longest-waiting
  player **who can afford the deposit**, takes it, and sends a push. Hosts can also
  promote a specific person (`promoteWaitlistFn`).

## Late cancellation (inside 24h of start)

- `LATE_CANCEL_WINDOW_MS` = 24h. Leaving inside it doesn't leave; it sets
  `lateCancelStatus = PENDING` and pushes to the admins and the host. The player keeps
  their spot meanwhile and can withdraw the request.
- **Approve**: deposit refunded, status NO. The approver can name a waitlisted
  replacement. If that replacement can't be moved in (balance), the whole approval
  rolls back.
- **Reject**: the player stays on, keeps the deposit held, and pays the full share at
  finalize. They can't ask again for that session.
- Leaving the **waitlist** never needs approval.

## Host contact

The session page shows a WhatsApp button for the host (`lib/phone.ts` `whatsAppLink`)
when the host has saved a phone number on their profile and isn't the viewer. No
prefilled message.

## Decision log

- 2026-10: late cancels inside 24h need host/admin approval. Rejected means you're
  charged. The approver can swap in someone from the waitlist (PR #13).
- 2026-10: waitlist is ordered (oldest first) and auto-promotes on an early leave, skipping
  anyone who can't cover the deposit.
- 2026-10: hosts got roster tools on the session page (walk-in, remove with confirm) so
  they don't need the admin console. Finalize asks for confirmation before charging.
- 2026-10: the "Wallet needs RM x to join" helper text was removed; the top-up button
  says it already.
- 2026-10: WhatsApp-the-host button, deliberately without prefilled text.
- 2026-10: profile **weekly streak**. A day counts as "played" when the player is YES on a
  **finalized** (LOCKED) session, so it appears after the host finalizes. A streak is
  consecutive Mon–Sun weeks (Malaysia time) with at least one played day; the current week
  doesn't break it until the week ends. Code: `features/profile/streak.ts`. The pill in the top bar and the sheet it opens
  (`StreakNav` in `streak-card.tsx`, mounted in `components/header.tsx`) show it; the profile page no longer has a card.
