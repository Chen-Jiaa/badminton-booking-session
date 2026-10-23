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
   On the Sessions page, people with a `YES` RSVP see it under **Happening now** (top of the
   Upcoming tab) from start until 24h after end (`RECORDING_GRACE_MS`) or until it's
   finalized: "Record match" only, no Join/Leave. Tapping it opens the recorder sheet right
   there (`RecordMatchDialog`, shared with the session page), no page load. `fetchSessionsFn` returns it as `live`
   and drops it from `past`. Without this, players saw a running session in neither tab
   (Past shows them only finalized sessions).
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

## Guests (bringing a friend)

A member can bring friends who don't have an account. Code: `sessions/guests.ts`
(`applyGuestChanges`), `updateGuestsFn` in `sessions/server.ts`, UI in
`sessions/guests-panel.tsx` ("Your guests" on the session page).

- A guest is a `users` row with `isGuest = true` and `sponsorId` (no login, no wallet,
  no email). They take a normal seat, can be waitlisted, and play and rank like anyone.
- **The sponsor pays.** Deposits, refunds and the finalize share go through the sponsor's
  wallet; ledger rows have `userId` = sponsor and `guestId` = the guest, so a guest's
  money is told apart from the sponsor's own (`payerOf`/`heldDeposit` in `roster.ts`).
  Anything that totals the ledger "per player" must key on `guestId ?? userId`.
- Limit `GUEST_LIMIT` = 5 per member per session. Each new friend needs a deposit on
  hand (like the waitlist rule). Names are free text; a friend brought before is a
  one-tap "Brought before" chip, which keeps their match history and leaderboard rank.
- **Late arrivals:** after the start (until the end) a member can still add a friend if a seat is
  free: no RSVP deadline, no waitlist (a full game refuses). Deposit is still taken.
- **Save is all or nothing** (`updateGuestsFn`: adds and removals in one transaction).
- If the sponsor leaves, the guests stay and the sponsor still pays. "Your guests" shows
  on the page whenever the member has guests, whether or not they're going themselves.
- Removing a guest follows the member rules: refund if early, a late-cancel request
  (approved by a host/admin, push says "<guest> (guest of <sponsor>)") inside 24h.
- Guests are hidden from every member list (admin members, member picker, CSV export).
  Pushes meant for a guest (promotion, late-cancel result, match invites) go to the sponsor.
- In matches the sponsor can answer for their guests (`sideOf`/`isWaitingOn` in
  `matches/logic.ts` also match `sponsorId`), since a guest can't sign in.
- Not built: hosts/admins adding a guest on a member's behalf (they use walk-ins), a
  "guest" badge on the leaderboard, turning a guest into a member.

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
- 2026-10: guests are lightweight `users` rows paid for by the sponsor, chosen over a
  separate guest table so attendance, matches and the leaderboard work unchanged. UI
  chosen from three prototypes: name-first sheet (tap past friends or type a name) over
  a count stepper and an inline panel. The sponsor's balance may go negative at finalize
  (same as members); only the deposit is checked up front.

## Players' phone numbers

- Players save a WhatsApp number on `/profile` (stored `+60…`). Only admins, and the host who
  created a session, receive attendees' numbers: `fetchSessionDetailFn` blanks them for everyone
  else on the server. Don't move that check into the UI. `e2e/phones.spec.ts` covers it.
- Tapping a player on the session page (host/admin) opens `PlayerActionsDialog`: Contact player
  (wa.me link) or Remove player (then the usual "Remove X?" confirmation).

- 2026-10: profile **weekly streak**. A day counts as "played" when the player is YES on a
  **finalized** (LOCKED) session, so it appears after the host finalizes. A streak is
  consecutive Mon–Sun weeks (Malaysia time) with at least one played day; the current week
  doesn't break it until the week ends. Code: `features/profile/streak.ts`. The pill in the top bar and the sheet it opens
  (`StreakNav` in `streak-card.tsx`, mounted in `components/header.tsx`) show it; the profile page no longer has a card.

- 2026-10: player FAQ (`/faq`, wording in `features/faq/content.ts`) restates the rules above in plain
  language (24h window, RM20 default deposit, 5 guests). When you change one of those rules, update the FAQ too.
