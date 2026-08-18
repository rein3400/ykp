/* Reproduce /api/hermez/run generateBriefForDate with dev logging.
 * Run: npx tsx tests/hermez-gen-brief.mts 2026-07-17
 */
import { initDbClients, createHermezDb, createHrDb, createFinanceDb, createMasterDb } from "../packages/schema/src";
import { generateBriefForDate } from "../packages/engine/src/hermez-brief";

const date = process.argv[2] ?? "2026-07-17";

async function main() {
  initDbClients();
  try {
    const result = await generateBriefForDate({
      hermezDb: createHermezDb(),
      hrDb: createHrDb(),
      financeDb: createFinanceDb(),
      masterDb: createMasterDb(),
      date,
    });
    console.log("[gen] OK", result.brief.briefId, "alerts", result.alerts.length, "level", result.brief.alertLevel);
    console.log("[gen] briefText:\n" + result.brief.briefText);
  } catch (e) {
    console.error("[gen] FAILED", e instanceof Error ? e.stack : String(e));
  }
  process.exit(0);
}

void main();