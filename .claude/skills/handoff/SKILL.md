---
name: handoff
description: Hand work over to the next Claude session cheaply. Writes a short handoff note to .context/handoff/, records review or audit findings as numbered items in .context/backlog.md, and adds anything non-obvious you learned to the project docs. Use when the user says "handoff", "wrap up", "save this for later", or before ending a session that leaves work for another one, and at the end of any review/audit that produced a list of items.
---

# Handoff

The next session should start from a short note, not from this whole transcript. Do
these steps, then tell the user in one line what you wrote and where.

## 1. Backlog items → `.context/backlog.md`

If this session produced a list of things to do (review findings, UX audit, ideas the user
deferred), add each one as a numbered item. Continue from the highest existing number and
never reuse a number, so "do 4" means the same thing in every session. Create the file
from this template if it doesn't exist:

```markdown
# Backlog

Parallel Claude sessions share this file. Claim an item before editing code for it and
list the files you expect to touch; check no open claim overlaps them. Keep each item
to a few lines: the title, why, and where.

<!-- status: open | claimed by <session/topic> | done (<commit or PR>) | dropped (<why>) -->

## 1. <short title>

status: open
files: src/...
<1–3 lines: what's wrong / what the user wants, and the chosen approach if decided>
```

Update the status of any item this session claimed or finished.

## 2. Handoff note → `.context/handoff/<topic>.md`

Only if work is unfinished or decisions were made that aren't in the code. At most ~15 lines:

```markdown
# <topic> (<date>, branch <branch>)

Goal: <one line, in the user's words>
Done: <what changed, files>
Decided: <user choices and rejected options, so they aren't re-asked>
Left: <next steps, or backlog item numbers>
Verify: <command or URL that shows it works>
```

Tell the user that the next session can be started with
`.context/handoff/<topic>.md do <n>` instead of attaching a transcript.

## 3. Feed the docs (only what's durable)

Ask yourself: what did I have to discover the hard way that the next session would have
to discover again? Add one line for each to the right place, and edit or replace stale
lines rather than appending contradictions:

| Learned                                                               | Goes in                                                          |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Command, port, tooling gotcha, file-location trap                     | `CLAUDE.md` (keep it under ~120 lines; move detail into `docs/`) |
| How a feature works / a product rule / why it's built this way        | `docs/<feature>.md` (decision log at the bottom)                 |
| A file moved, renamed or added (page, server function, shared helper) | `docs/map.md`                                                    |
| Env var added/removed, migration applied to live                      | `docs/env.md`, `drizzle/APPLIED.md`                              |
| How to run, see or test the app                                       | `.claude/skills/preview/SKILL.md`                                |
| The user's taste (what they removed, chose, rejected)                 | the Design bullet in `CLAUDE.md`                                 |

Skip anything that's already in the code, the git log, or the docs. Don't record
this session's narrative. Doc edits are part of the change, so commit them with it.
