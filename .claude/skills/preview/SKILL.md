---
name: preview
description: Run this app locally and screenshot pages as any seeded user (player, admin…) on a phone viewport, to see a UI change or show it to the user. Use whenever you need to look at a page, check a change visually, reproduce a UI bug, or "show me how it looks". Don't write ad-hoc Playwright scripts or start `pnpm dev` on a random port for this.
---

# Preview the app

Two commands. Both run on the local `badminton_test` DB, never live Supabase.

## 1. Server (once per conversation)

```bash
curl -s -o /dev/null http://localhost:3200 && echo up   # reuse it if it's already running
pnpm dev:test        # run_in_background: true. Rebuilds + seeds the test DB, serves :3200
```

Then wait until it answers: `until curl -s -o /dev/null http://localhost:3200; do sleep 2; done`
(use Monitor, not a foreground sleep). Vite hot-reloads your edits, so don't restart it
after code changes. Restart only after a `schema.ts` change, since the DB is rebuilt on
start (`--no-reset` keeps the data).

To click around by hand (the user, on laptop or phone), use `pnpm dev:local` instead and
`/api/dev-login`: see `docs/env.md` → Local dev server.

## 2. Screenshots

```bash
pnpm -s shot <path>... [--as <user>] [--full] [--desktop] [--hires] [--reseed] [--name <file>]
```

- Prints the saved paths (`.context/shots/<path>-<user>.png`). Read them with the Read tool,
  and embed them in the final message for the user as `![x](<absolute path>)`.
- `--as`: `admin`, `player`, `ben`, `cai`, `dee`, `lou` (see `SEED_USERS` in `e2e/seed.ts`).
  Omit to see the signed-out page.
- Pixel 7 viewport at CSS-pixel size (~412×840) with reduced motion. That's cheap to read.
  Use `--hires` only when the user needs to judge fine detail, and `--full` for the whole
  scroll height.
- `--reseed`: back to a fresh seed first (after you've changed data by clicking around, or after
  `pnpm test:e2e`, which shares the `badminton_test` DB and leaves the last test's data behind).
- External requests (the Google Map) are blocked, so the map area is blank. That's expected.

## Useful URLs

| What                                              | Path                                                                | As                               |
| ------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------- |
| Session list                                      | `/sessions`                                                         | player                           |
| Open session, room left                           | `/sessions/e2eupcoming`                                             | player                           |
| Full session (waitlist)                           | `/sessions/e2efull`                                                 | player / admin                   |
| Inside 24h late-cancel window                     | `/sessions/e2elate`                                                 | ben (attendee), cai (waitlisted) |
| Finished, not finalized                           | `/sessions/e2efinished`                                             | admin                            |
| Live, has matches                                 | `/sessions/e2elive`                                                 | player                           |
| Leaderboard / Wallet (top-up, withdraw) / Profile | `/leaderboard` `/wallet` `/profile`                                 | player                           |
| Admin console                                     | `/admin/sessions` `/admin/finance` `/admin/members` `/admin/topups` | admin                            |

Admin pages live under `/admin/...`; `/admin` itself is a 404.

## When a screenshot isn't enough

To click through a flow (open a dialog, type, submit), write a Playwright test in `e2e/`
using the `loginAs` fixture instead of a throwaway script. It's reusable and it runs in
`pnpm test:e2e`. For a one-off look at an interaction, a short script that imports
`accessTokenFor` / `waitForHydration` from `e2e/browser.ts` (see `scripts/shot.ts`)
is fine. Put it in `.context/`, not `/tmp`.

## Gotchas

- In code sent into the browser (`page.evaluate`, `waitForFunction`), don't define named
  functions: tsx wraps them in `__name`, which doesn't exist in the page.
- Seeded ids must be alphanumeric: the session route strips everything after a `-` as
  pasted-link junk.
- Browser missing ("Executable doesn't exist") → `pnpm exec playwright install chromium`.
