/* Sync finance schema summary table to Drizzle definition (additive DDL, idempotent).
 * Run: npx tsx tests/finance-schema-sync.mts
 * Adds missing columns required by generateBriefForDate.
 */
import { initDbClients, createFinanceDb } from "../packages/schema/src";

const DDL: string[] = [
  `ALTER TABLE finance.fin_daily_summary ADD COLUMN IF NOT EXISTS settlement_difference integer NOT NULL DEFAULT 0;`,
];

async function main() {
  initDbClients();
  const db = createFinanceDb();
  for (const stmt of DDL) {
    try {
      await db.execute(stmt as never);
      console.log("[sync] OK:", stmt.slice(0, 90).replace(/\s+/g, " "));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[sync] FAILED:", stmt.slice(0, 90).replace(/\s+/g, " "), "->", msg);
    }
  }
  console.log("[sync] done");
  process.exit(0);
}

void main();