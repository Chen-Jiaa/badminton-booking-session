# Matches & monthly leaderboard

Players record the games they play at a session, the other side confirms the
result, and confirmed results feed a monthly leaderboard. Shipped October 2026.

## How it works

### Lifecycle of a match

```
                 ┌──────── accept ───────┐
record (no score)│                       ▼
  ──────────► INVITED ──decline──► DECLINED ◄──"we didn't play"──┐
                                       ▲                         │
                                     IN_PLAY ──enter result──► AWAITING_CONFIRM ──confirm──► CONFIRMED
record (with score) ─────────────────────────────────────────►   │      ▲
                                                                  └dispute┘ (new score, sides swap)
```

- **Side A is always the recorder's side.** The recorder's partner is auto-accepted.
- **Whoever didn't enter the current score must respond.** `waitingSide()` in
  `logic.ts` is the single source of truth: for `INVITED` it's the side opposite the
  creator; for `AWAITING_CONFIRM` it's the side opposite `submittedById`.
- **One player from the waiting side is enough** to accept, confirm or dispute.
- **Guests are answered for by their sponsor**, unless the sponsor plays on the other side
  of that match (a member never confirms their own result).
- **Singles against your own guest** has nobody to answer, so it's "stuck" (`isStuck()`):
  the session's host or an admin (never someone playing in it) can accept, confirm or
  decline it, and gets the push instead of the guest's sponsor. The nav badge doesn't count these.
- **Dispute = enter the score you think is right.** It stores the replaced score in
  `previous_score_a/b` (shown struck-through on the card), sets `submittedById` to the
  disputer, and so flips the waiting side back. It can go back and forth.
- **"We didn't play this match"** (inside the dispute sheet) and **Decline** on an
  invite both set `DECLINED`. Declined matches are hidden and never count.
- **Pending matches expire** 48h after their last change (`expiresAt`). There's no
  cron: expiry is computed on read (`isExpired()`), and expired matches can't be
  answered.
- Status changes use a guarded update (`WHERE status = <checked> AND updated_at =
<checked>`), so two people tapping at once can't both win. `updated_at` is needed
  because a dispute keeps the status (`AWAITING_CONFIRM`). It's always written from
  JS, never `defaultNow()`, so it round-trips at millisecond precision.

### Who can record, and when

- Any player with a `YES` attendance for the session; every player in the match
  must also be a `YES` attendee.
- From the session's start until 24h after it ends (`RECORDING_GRACE_MS`). The same
  window applies to entering the score for an accepted (`IN_PLAY`) match.
- `IN_PLAY` matches never expire. Once that window has passed, the card swaps
  "Enter result" for **Delete match** (`deleteMatchFn`): any player in the match can
  hard-delete it. Only `IN_PLAY` matches can be deleted; anything with a score has to
  be confirmed, disputed or declined.
- Singles (1v1) or doubles (2v2). Scores are free-form: whole numbers 0 to 30,
  not level. No 21-point rules, so casual games to 11 or 15 are fine.

### Leaderboard

- **Monthly**, by the club-local (Malaysia, UTC+8, no DST) month of the
  **session's start time**, not when the match was confirmed. Past months keep their
  final standings; the switcher goes back to the first month with a confirmed match.
- **Only `CONFIRMED` matches count.** One confirmed match in the month puts you on
  the board (there used to be a 3-match minimum; dropped Oct 2026).
- **Top players: ranked by points**, the rally points their side scored, summed over
  every match they played, _whichever partner they had_ (singles included).
  Ties → more wins → better win rate → whoever got there first.
- **Top teams: ranked by wins** together as a doubles pair (pair = two sorted user
  ids). Ties → better win rate → whoever got there first.
- **"Got there first"** = `reachedAt`, the play order (`createdAt`) of the match that
  last raised the ranking number (points for players, wins for teams). Earlier wins.
- **Streak** = wins in a row up to the latest match (🔥 badge from 3).
  **Last 5** = last five results, newest on the right.
- Computed in `buildStandings()` from the month's confirmed matches. There are no
  denormalised stats tables to keep in sync.

### Where things live

| What                                                                         | Where                                                                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Tables `matches`, `match_players`; enums                                     | `src/db/schema.ts`, `drizzle/0006_sparkling_red_ghost.sql`                                    |
| Rules + leaderboard maths (pure, client-safe)                                | `src/features/matches/logic.ts`                                                               |
| Server functions (create, enter/dispute, respond, delete, list, leaderboard) | `src/features/matches/server.ts`                                                              |
| Server-only DB helpers (see warning below)                                   | `src/features/matches/queries.ts`                                                             |
| Input validation                                                             | `createMatchSchema` etc. in `src/lib/validations.ts`                                          |
| Push notifications                                                           | `sendMatch*Notification` in `src/lib/push.ts`                                                 |
| Session page section                                                         | `session-matches.tsx` → `court-recorder.tsx`, `match-card.tsx`, `result-dialog.tsx`           |
| Leaderboard                                                                  | `src/routes/_app/leaderboard.tsx` → `src/features/matches/leaderboard.tsx`                    |
| "Waiting for you" count                                                      | `countMatchesWaitingOn()` → `fetchCurrentUserFn` → Sessions tab badge + banner on `/sessions` |
| Animations (`score-tick`, `slot-fill`, `stamp-land`, `rise-in`)              | `src/styles/globals.css`                                                                      |

### Guests in matches

A guest (see `docs/sessions.md`) can be picked like any attendee and ranks on the
leaderboard under their own name. They can't sign in, so their **sponsor answers for
them**: `sideOf`/`isWaitingOn` also match `MatchPlayerView.sponsorId`, push tokens for a
guest resolve to the sponsor (`pushTokensFor`), and the "waiting for you" count includes
the sponsor's guests.

## Decision log

Decided with the club owner through clickable prototypes, Oct 2026.

| Decision                                                                                                             | Why / alternatives rejected                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any attendee can record; the opponent side confirms                                                                  | Keeps it fun and fast while keeping results honest. Host-only recording was rejected                                                                                                |
| Partner auto-accepted; one opponent's confirmation is enough                                                         | Fewer taps; disputes cover mistakes                                                                                                                                                 |
| Invite flow for matches not finished yet (accept → in play → enter result)                                           | Owner asked that opponents can accept before or after the game                                                                                                                      |
| Dispute = enter the correct score (not a flat reject)                                                                | Owner: "dispute should allow the person to key in another result instead of straight declining"                                                                                     |
| Recording UI: **Court** design (players placed on a drawn court; tap a score to type it, or tap a half for +1)       | Chosen over a one-screen sheet and a step-by-step wizard. Typing was added because tapping 21 times was too slow                                                                    |
| My result shown as a small, thin **Stamp** ("WON" / "LOST", dashed "WON?" while pending) that thumps down on confirm | Chosen over a full-width banner and a W/L tile. Owner asked for it thinner and then smaller. A loss is quiet gray, a win soft pink                                                  |
| Leaderboard: **Merged** design (podium for the top 3 + full table for everyone, with a legend)                       | Chosen over podium-only, table-only and bars. "Form" was renamed "Last 5" and a legend added because the terms weren't self-explanatory                                             |
| "Your rank" card follows the Players/Teams tab (shows your best team, "with <partner>")                              | Owner request                                                                                                                                                                       |
| **Top players ranked by points scored (option A)**, not wins                                                         | The club rarely plays singles, so individual credit has to come from doubles. Owner chose A over "3 for a win, 1 for a loss" and "wins only", knowing it rewards playing more games |
| Top teams ranked by wins                                                                                             | Owner: "ranking based on most win"                                                                                                                                                  |
| No minimum matches; ties go to whoever reached the score first                                                       | Owner: "why can't we just rank from the 1 match? whoever wins earliest be the top". Replaced the 3-match minimum                                                                    |
| Leaderboard is a bottom-nav tab for everyone (admins get 4 tabs)                                                     | Owner confirmed 4 tabs is fine                                                                                                                                                      |
| Free-form scores (0–30, not level)                                                                                   | Casual games to 11/15 happen                                                                                                                                                        |
| Brand restraint: soft pink, Inter only, reduced-motion respected                                                     | Standing owner preference: an earlier "bolder/hot pink" pass was rejected                                                                                                           |

## Gotchas for future work

- **Never put plain helpers that touch `db` in a file the browser imports.** TanStack
  Start strips server-function _bodies_ from the client bundle, but not plain
  functions next to them. One such helper in `matches/server.ts` pulled the `postgres`
  driver into the browser and broke every page (`Buffer is not defined`). Put DB
  helpers in a module like `queries.ts` and import them only inside handlers.
- `fetchCurrentUserFn` queries the match tables on every page load, so a database
  without migration 0006 breaks the whole app for signed-in users.
- Timestamps are `timestamp` without time zone and hold **UTC**. When seeding with raw
  SQL, use `now() at time zone 'utc'`, not `now()`.
