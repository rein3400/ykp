# Task 1 Report: Finance POS Individual Receipt — Schema + Migration

**Status:** DONE

**Scope:** `ykp-erp/packages/schema/src/finance.ts`, `ykp-erp/packages/schema/src/migrate.ts`, plus seed/tooling fixes needed to verify the migration.

## What changed

1. `ykp-erp/packages/schema/src/finance.ts`
   - Added `finPosReceipts` table with all required columns and `UNIQUE (date, outlet_id, receipt_number)`.
   - Added `finPosDailyView` helper (`finance.view(...).existing()`) that reproduces the old `fin_pos_daily` column shape.
   - Kept the deprecated `finPosDaily` table export and `FinPosDaily` / `NewFinPosDaily` types so existing consumers still compile.
   - Added `FinPosReceipt` / `NewFinPosReceipt` type exports.

2. `ykp-erp/packages/schema/src/migrate.ts`
   - Added `financeV2Receipts` step, executed after Drizzle's `migrate()` under the same advisory lock acquisition.
   - Creates `finance.fin_pos_receipts` if not exists.
   - Migrates legacy `finance.fin_pos_daily` rows into receipts inside a `DO $$ ... IF EXISTS ... $$` block (idempotent; safe to re-run).
   - Drops `finance.fin_pos_daily`.
   - Creates / replaces `finance.fin_pos_daily_view` aggregating receipts back to the old daily shape.

3. `ykp-erp/packages/schema/src/seed.ts` and `seed-pilot.ts`
   - Switched POS seed from inserting into `finPosDaily` to inserting into `finPosReceipts`, mapping daily fields to receipt fields.

4. `ykp-erp/packages/schema/src/db/clients.ts`
   - Disabled SSL for `localhost` / `127.0.0.1` connections so the local Postgres container can be used. Production Supabase direct/pooler paths remain unchanged.

5. `ykp-erp/package.json` and `scripts/migrate.mjs`
   - Fixed `db:generate` to run from `packages/schema` directory.
   - Fixed `db:migrate` wrapper to use `node --import tsx` instead of `spawn("npx", ...)` which was broken on Windows (`spawn npx ENOENT`).

## Generated migration

- `ykp-erp/packages/schema/migrations/0001_broad_screwball.sql` created by Drizzle.
- `ykp-erp/packages/schema/migrations/meta/0001_snapshot.json` and `_journal.json` updated.

## Commands run and output

### `npm run db:generate`

```text
> ykp-erp@0.1.0 db:generate
> cd packages/schema && npx drizzle-kit generate --config=drizzle.config.ts

Reading config file ...\ykp-erp\packages\schema\drizzle.config.ts
31 tables
...
No schema changes, nothing to migrate
```

(After first generation the migration file `0001_broad_screwball.sql` was produced; subsequent runs show no diff.)

### `npm run db:migrate`

```text
> ykp-erp@0.1.0 db:migrate
> node scripts/migrate.mjs

[migrate] starting (single DB, schema-per-domain: master/hr/finance/hermez)
[migrate] acquired advisory lock 74213721
[migrate] applied migrations from ...\ykp-erp\packages\schema\migrations
[migrate] finance_v2_receipts step completed
[migrate] completed in ...ms
```

### Legacy migration verification

A synthetic `fin_pos_daily` row was inserted into a fresh DB and the migration re-run. Result:

```text
receipt_id                  | date       | outlet_id | receipt_number         | gross_sales | net_sales | source
---------------------------+------------+-----------+------------------------+-------------+-----------+--------
RCP-20260717-OL-001-LEGACY-1 | 2026-07-17 | OL-001    | LEGACY-20260717-OL-001 |     1000000 |    900000 | moka

pos_id              | date       | outlet_id | gross_sales | net_sales | transaction_count | aov   | source
--------------------+------------+-----------+-------------+-----------+-------------------+-------+--------
POS-20260717-OL-001 | 2026-07-17 | OL-001    |     1000000 |    900000 |                10 | 90000 | moka
```

`fin_pos_daily` table was dropped; `fin_pos_receipts` and `fin_pos_daily_view` exist.

### `npm run typecheck`

All 9 workspaces passed with no errors:

```text
@ykp/finance  ✓
@ykp/hermez   ✓
@ykp/hr       ✓
@ykp/auth     ✓
@ykp/config    ✓
@ykp/engine    ✓
@ykp/format    ✓
@ykp/schema    ✓
@ykp/ui        ✓
```

## Commits

- `176cb0e feat(schema): fin_pos_receipts source of truth + daily view`

## Concerns / blockers

1. **Schema drift from keeping `finPosDaily` table export:** The old `fin_pos_daily` table is physically dropped, but `finance.ts` still declares the `finPosDaily` table symbol. This is intentional per the brief ("do not rename yet"), but if `db:generate` is re-run after the table is dropped, Drizzle may try to recreate it. Mitigation: the generated migration only runs once; follow-up tasks (Task 7+) will switch consumers to `finPosDailyView` and then the table export can be removed.
2. **`finPosDailyView` columns are nullable:** Because the view uses `.existing()`, inferred columns are nullable. Consumers that switch from the table to the view will see `| null` types and may need minor type assertions. This is expected for a view over aggregated data.
3. **Local-only `clients.ts` SSL change:** The localhost SSL disable is a dev-only convenience; production paths remain strict.

## Next steps (Task 2 onwards)

- Add `receiptId` generator in `packages/engine/src/id-gen.ts`.
- Rewrite `packages/engine/src/moka-importer.ts` to emit per-receipt records.
- Update POS import/receipt APIs and frontend components.
