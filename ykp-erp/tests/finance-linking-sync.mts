/* Sync finance transaction tables to Drizzle "Revisi item 4" cross-transaction linking columns.
 * Root cause of prod 500 on GET/POST /api/fin/{expense,supplier,petty-cash,unpaid}:
 *   Drizzle schema (packages/schema/src/finance.ts) defines linking columns that were
 *   never ALTERed into the production Supabase DB. db.select() (SELECT *) / insert hits
 *   "column ... does not exist" (PG 42703) -> masked internal_error envelope.
 *
 * Fix: additive, idempotent ADD COLUMN IF NOT EXISTS. No data loss. No code change needed.
 *
 * Run: npx tsx tests/finance-linking-sync.mts
 *   (requires YKP_FINANCE_DATABASE_URL pointing at prod Supabase pooler in env)
 *
 * Verified by deep-test 2026-07-23. See tests/WEBBRIDGE_PREDEMO_2026-07-23.md.
 */
import { initDbClients, createFinanceDb } from "../packages/schema/src";

const DDL: string[] = [
  // fin_expense (packages/schema/src/finance.ts ~:275-281)
  `ALTER TABLE finance.fin_expense ADD COLUMN IF NOT EXISTS source_module text;`,
  `ALTER TABLE finance.fin_expense ADD COLUMN IF NOT EXISTS source_transaction_id text;`,
  `ALTER TABLE finance.fin_expense ADD COLUMN IF NOT EXISTS payment_source text;`,
  `ALTER TABLE finance.fin_expense ADD COLUMN IF NOT EXISTS linked_supplier_invoice_id text;`,
  `ALTER TABLE finance.fin_expense ADD COLUMN IF NOT EXISTS linked_petty_cash_id text;`,
  `ALTER TABLE finance.fin_expense ADD COLUMN IF NOT EXISTS linked_payment_id text;`,

  // fin_supplier_cost (packages/schema/src/finance.ts ~:203-209)
  `ALTER TABLE finance.fin_supplier_cost ADD COLUMN IF NOT EXISTS source_module text;`,
  `ALTER TABLE finance.fin_supplier_cost ADD COLUMN IF NOT EXISTS source_transaction_id text;`,
  `ALTER TABLE finance.fin_supplier_cost ADD COLUMN IF NOT EXISTS payment_source text;`,
  `ALTER TABLE finance.fin_supplier_cost ADD COLUMN IF NOT EXISTS linked_expense_id text;`,
  `ALTER TABLE finance.fin_supplier_cost ADD COLUMN IF NOT EXISTS linked_petty_cash_id text;`,
  `ALTER TABLE finance.fin_supplier_cost ADD COLUMN IF NOT EXISTS linked_payment_id text;`,

  // fin_petty_cash (packages/schema/src/finance.ts ~:240-246)
  `ALTER TABLE finance.fin_petty_cash ADD COLUMN IF NOT EXISTS source_module text;`,
  `ALTER TABLE finance.fin_petty_cash ADD COLUMN IF NOT EXISTS source_transaction_id text;`,
  `ALTER TABLE finance.fin_petty_cash ADD COLUMN IF NOT EXISTS payment_source text;`,
  `ALTER TABLE finance.fin_petty_cash ADD COLUMN IF NOT EXISTS linked_expense_id text;`,
  `ALTER TABLE finance.fin_petty_cash ADD COLUMN IF NOT EXISTS linked_supplier_invoice_id text;`,
  `ALTER TABLE finance.fin_petty_cash ADD COLUMN IF NOT EXISTS linked_payment_id text;`,
];

async function main() {
  initDbClients();
  const db = createFinanceDb();
  let ok = 0;
  let failed = 0;
  for (const stmt of DDL) {
    try {
      await db.execute(stmt as never);
      ok++;
      console.log("[sync] OK:", stmt.slice(0, 90).replace(/\s+/g, " "));
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[sync] FAILED:", stmt.slice(0, 90).replace(/\s+/g, " "), "->", msg);
    }
  }
  console.log(`[sync] done — ${ok} ok, ${failed} failed (of ${DDL.length})`);
  if (failed > 0) process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}

void main();