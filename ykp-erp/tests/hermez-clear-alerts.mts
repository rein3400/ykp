/* Clear Hermez alerts+brief for a date so generate can re-run cleanly.
 * Run: npx tsx tests/hermez-clear-alerts.mts 2026-07-15
 */
import { initDbClients, createHermezDb } from "../packages/schema/src";
import { hermezAlertLog, hermezDailyBrief } from "../packages/schema/src";
import { eq } from "drizzle-orm";

const date = process.argv[2] ?? "2026-07-15";

async function main() {
  initDbClients();
  const db = createHermezDb();
  const d = new Date(date);
  await db.delete(hermezAlertLog).where(eq(hermezAlertLog.date, d));
  await db.delete(hermezDailyBrief).where(eq(hermezDailyBrief.date, d));
  console.log(`[clear] deleted alerts+brief for ${date}`);
  process.exit(0);
}

void main();