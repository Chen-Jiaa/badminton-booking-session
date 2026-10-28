# Badges

Lifetime medals on the profile page, and small tags under names on the leaderboard.
Shipped October 2026. **Nothing is stored**: every number is worked out on request from
`attendances`, `sessions`, `matches` and `users`, so there is no table to keep in sync and
no migration.

## How it works

- **Every badge is a counter that only goes up.** No tiers, no finish line (owner:
  "a number in the medal so it's always accumulating instead of a tier to reach"). A badge
  is **locked** (grey, 0) until its number reaches `min`, then it shows the number.
- **Members only.** Guests never earn badges. A guest's visit counts for their sponsor
  (Friend Bringer).
- **Month-based badges only count months that have ended**, so a shown number never
  drops. "Month" = club-local (Malaysia) month of the session's start, like the leaderboard.
- **"Finalized" = session status `LOCKED`.** Approved late cancels are `NO` and don't count.

| Badge            | Counts                                                                                                      | Earned from |
| ---------------- | ----------------------------------------------------------------------------------------------------------- | ----------- |
| Regular          | finalized sessions you played                                                                               | 1           |
| Never Missed     | ended months where you played **every** finalized session                                                   | 1           |
| Streak Keeper    | your longest run of Mon–Sun weeks with a played session                                                     | 2 weeks     |
| Early Bird       | sessions where you RSVPed within 1 hour of it being posted (`attendances.createdAt` − `sessions.createdAt`; rejoining after leaving resets `createdAt`) | 1           |
| Friend Bringer   | finalized sessions your guests played                                                                       | 1           |
| Reliable         | ended months you played with no approved (or pending) late cancel                                           | 1           |
| Founding Member  | one-off: you joined before 19 Nov 2026, a month after launch (`FOUNDING_CUTOFF`, `users.createdAt`). Hidden from everyone else's shelf, not shown locked | –           |
| Monthly Champion | ended months you were #1 on **Top players**                                                                 | 1           |
| Podium           | ended months you were top 3 on **Top players**                                                              | 1           |
| Hot Hand         | your best run of confirmed match wins in a row (play order)                                                 | 3 wins      |
| Dynamic Duo      | most confirmed doubles wins with one partner                                                                | 3 wins      |
| Rally Machine    | every rally point your side scored in confirmed matches                                                     | 1           |

`min` > 1 on Streak Keeper, Hot Hand and Dynamic Duo, otherwise a single week or a single win
would hand everyone the badge.

## Where it shows

- **Profile** (`/profile`): `BadgeShelf`, two groups (Showing up, Winning). Tap a medal for the
  full-screen "Award unlocked" view (`AwardScreen`): drag to spin the 3D medal, mouse
  anywhere tilts it, "Earned by X% of members" with real avatars.
- **Leaderboard**: `BadgeChips` under a name on the **Attendance** tab and **Top players**
  table (one chip + "+N", the player's **rarest** badges first, so it says what's special about them).

## Where things live

| What                             | Where                                                                       |
| -------------------------------- | --------------------------------------------------------------------------- |
| Names, wording, colours, `min`   | `src/features/badges/catalog.ts`                                            |
| The maths (pure, tested via e2e) | `src/features/badges/logic.ts` (`computeBadgeNumbers`, `earnedByPercent`)   |
| Loading rows                     | `src/features/badges/queries.ts` (**server-only**, `loadBadgeNumbers`)      |
| Server functions                 | `src/features/badges/server.ts` (`fetchMyBadgesFn`, `fetchBadgeChipsFn`)    |
| Artwork                          | `src/features/badges/art.tsx` (one hand-drawn SVG per badge, `BadgeArt`)    |
| UI                               | `badge-shelf.tsx`, `badge-medal.tsx`, `award-screen.tsx`, `badge-chips.tsx` |
| Popup animations                 | `.award-*` in `src/styles/globals.css` (reduced-motion safe)                |
| Longest weekly streak            | `longestStreak` in `src/features/profile/streak.ts`                         |

## Decision log

Decided with the club owner through a clickable prototype, Oct 2026.

| Decision                                                      | Why / alternatives rejected                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Counters, not Bronze/Silver/Gold tiers                        | Tiers imply a finish line. A number just keeps growing                           |
| No "earn again each month" badges                             | Owner: it dismisses the medals                                                   |
| Custom illustrated medals, not icons in a circle              | A circle with an icon "just feels like an icon". Reference: Apple Fitness awards |
| Light profile page, dark medal plates and dark popup          | Owner removed the dark panel behind the shelf                                    |
| Scorekeeper badge dropped; Club life merged into Showing up   | Owner                                                                            |
| Walk-ins count for Early Bird at the time the host added them | Owner: fine as is; no "added by host" column                                     |
| Founding Member: launch 19 Oct 2026 + 1 month; hidden for later joiners | Owner: a badge you can never earn shouldn't sit locked on your shelf |

## Gotchas / not done

- **Early Bird counts host-added walk-ins** by the time the host added them (not tracked).
- **`attendances.createdAt` means "when this RSVP started"**: the RSVP, bring-a-friend and host-add paths reset it when a row goes from `NO` back to in (moving up from the waitlist keeps it). Without that, joining early, leaving, and rejoining days later kept the early time.
- **Cost**: each call reads all attendances, sessions and confirmed matches. Fine for a club;
  if it grows, cache `loadBadgeNumbers` for a minute.
- Not built: badge notifications ("you unlocked X"), seeing other members' shelves, a
  gyroscope tilt on phones.
