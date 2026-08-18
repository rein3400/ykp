/* Show latest hermez_telegram_log rows.
 * Run: npx tsx tests/hermez-tg-log.mts
 */
import { initDbClients, createHermezDb } from "../packages/schema/src";
import { hermezTelegramLog } from "../packages/schema/src";
import { desc } from "drizzle-orm";

async function main() {
  initDbClients();
  const db = createHermezDb();
  const rows = await db.select().from(hermezTelegramLog).orderBy(desc(hermezTelegramLog.sentAt)).limit(8);
  console.log("[tglog] rows:", rows.length);
  for (const r of rows) {
    console.log(`  ${r.sentAt.toISOString()} | ${r.status} | msg=${r.messageId} | recipient=${r.recipient} | channel=${r.channel} | retry=${r.retryCount} | err=${r.errorMessage ?? "-"}`);
  }
  process.exit(0);
}

void main();