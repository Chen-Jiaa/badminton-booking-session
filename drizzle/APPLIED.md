# Migrations applied to live

The live Supabase DB has no `drizzle` migrations table, so this file is the record. Add
a row in the same change that applies a migration (see "Database changes" in CLAUDE.md).

| Migration                            | What                                                            | Live                            | Check (`true` = applied)                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 0000_lame_harpoon                    | initial schema                                                  | yes                             |                                                                                                                                      |
| 0001_clear_blizzard                  | `withdrawal_requests`                                           | yes                             |                                                                                                                                      |
| 0002_deposit_refund_types            | `SESSION_DEPOSIT` / `SESSION_REFUND` ledger types               | yes                             | `select exists(select 1 from pg_enum where enumlabel='SESSION_DEPOSIT')`                                                             |
| 0003_add_host_role_and_shuttle_count | `HOST` role, `sessions.shuttle_count`                           | yes                             | `select exists(select 1 from pg_enum where enumlabel='HOST')`                                                                        |
| 0004_optimal_amazoness               | `expenses`, `WITHDRAWAL` ledger type                            | yes                             | `select to_regclass('public.expenses') is not null`                                                                                  |
| 0005_modern_post                     | `sessions.courtsite_ref`                                        | yes                             | `select exists(select 1 from information_schema.columns where table_name='sessions' and column_name='courtsite_ref')`                |
| 0006_sparkling_red_ghost             | `matches`, `match_players`                                      | yes                             | `select to_regclass('public.matches') is not null`                                                                                   |
| 0007_sloppy_mauler                   | waitlist order + late-cancel columns on `attendances`           | yes                             | `select exists(select 1 from information_schema.columns where table_name='attendances' and column_name='late_cancel_status')`        |
| 0008_curious_network                 | RLS on every table, no policies (locks out the anon REST API)   | yes (2026-10-20)                | `select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where nspname='public' and relkind='r'` |
| 0009_tidy_millenium_guard            | guests: `users.is_guest`, `users.sponsor_id`, `ledger.guest_id` | yes (2026-10-21)                | `select exists(select 1 from information_schema.columns where table_name='users' and column_name='is_guest')`                        |

Verified against live on 2026-10-20 (read-only). `schema.ts` matched the 0007 snapshot then
(`drizzle-kit generate` into a copy produced nothing). The withdrawal payout columns
(`payment_method`, `bank_name`, …) are on live and in the snapshots, though no
migration file adds them.

Run a check read-only, so a typo can't change anything:

```bash
PGOPTIONS='-c default_transaction_read_only=on' psql "$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')" -At -c "<check>"
```

`psql` here is Homebrew's `/opt/homebrew/opt/postgresql@14/bin/psql`. It isn't always on
PATH, and there is no `postgresql@16`.

## Outside Drizzle

Supabase Storage lives in the `storage` schema, which Drizzle doesn't manage. Set up by hand:

| What              | Live             | Check                                                                          |
| ----------------- | ---------------- | ------------------------------------------------------------------------------ |
| `receipts` bucket | yes (2026-10-20) | `select public, file_size_limit from storage.buckets where id='receipts'` → `f | 2097152` |

To recreate it (private, 2 MB, photos only; `lib/supabase.ts` and `features/topup/receipt.ts` rely on these):

```bash
curl -X POST "$VITE_SUPABASE_URL/storage/v1/bucket" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"receipts","name":"receipts","public":false,"file_size_limit":2097152,"allowed_mime_types":["image/jpeg","image/png","image/webp","image/heic","image/heif"]}'
```
