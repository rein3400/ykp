/* Probe Hermez DB layer with production env to reproduce the 500.
 * Run: npx tsx tests/probe-hermez-db.mts
 * Prints the real error (dev logging) instead of swallowing it.
 */
import { createHermezDb, initDbClients, createHrDb, createFinanceDb } from "../packages/schema/src";
import { hermezDailyBrief, hermezAlertLog, hermezConfig } from "../packages/schema/src";
import { hrDailySummary, finDailySummary } from "../packages/schema/src";
import { desc, eq } from "drizzle-orm";

async function main() {
  initDbClients();
  const db = createHermezDb();
  console.log("[probe] hermez db url:", maskUrl(process.env.YKP_HERMEZ_DATABASE_URL ?? process.env.YKP_DATABASE_URL ?? ""));

  console.log("\n[probe] latest brief...");
  try {
    const rows = await db.select().from(hermezDailyBrief).orderBy(desc(hermezDailyBrief.date)).limit(3);
    console.log("[probe] brief rows:", rows.length, rows.map((r) => ({ id: r.briefId, date: r.date, level: r.alertLevel, sent: r.sentToOwner })));
  } catch (e) {
    console.error("[probe] brief query FAILED:", e instanceof Error ? e.stack : String(e));
  }

  console.log("\n[probe] latest alerts...");
  try {
    const a = await db.select().from(hermezAlertLog).limit(5);
    console.log("[probe] alert rows:", a.length);
  } catch (e) {
    console.error("[probe] alert query FAILED:", e instanceof Error ? e.stack : String(e));
  }

  console.log("\n[probe] config...");
  try {
    const c = await db.select().from(hermezConfig).limit(5);
    console.log("[probe] config rows:", c.length, c.map((r) => r.key));
  } catch (e) {
    console.error("[probe] config query FAILED:", e instanceof Error ? e.stack : String(e));
  }

  // Schema introspection: list tables + columns of hermez tables
  console.log("\n[probe] introspect tables...");
  try {
    const t = await db.execute(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename" as never,
    );
    const rows = (t as unknown as Array<{ tablename: string }>) ?? [];
    console.log("[probe] tables:", rows.map((r) => r.tablename).join(", "));
  } catch (e) {
    console.error("[probe] introspect FAILED:", e instanceof Error ? e.stack : String(e));
  }

  console.log("\n[probe] columns of all hermez tables...");
  for (const tbl of [
    "hermez_daily_brief",
    "hermez_alert_log",
    "hermez_config",
    "hermez_telegram_log",
    "hermez_action_tracker",
    "audit_log",
    "hr_daily_summary",
    "fin_daily_summary",
  ]) {
    try {
      const c = await db.execute(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='${tbl}' ORDER BY ordinal_position` as never,
      );
      const cols = (c as unknown as Array<{ column_name: string; data_type: string }>) ?? [];
      console.log(`[probe] ${tbl}:`, cols.map((x) => `${x.column_name}:${x.data_type}`).join(", "));
    } catch (e) {
      console.error(`[probe] columns ${tbl} FAILED:`, e instanceof Error ? e.message : String(e));
    }
  }

  console.log("\n[probe] summary data for recent dates...");
  const hrDb = createHrDb();
  const financeDb = createFinanceDb();
  try {
    const hr = await hrDb
      .select({ date: hrDailySummary.date, brand: hrDailySummary.brand, outlet: hrDailySummary.outlet, totalStaff: hrDailySummary.totalStaff, staffLate: hrDailySummary.staffLate })
      .from(hrDailySummary)
      .orderBy(desc(hrDailySummary.date))
      .limit(5);
    console.log("[probe] hr_daily_summary rows:", hr.map((r) => ({ date: r.date.toISOString().slice(0, 10), brand: r.brand, outlet: r.outlet, totalStaff: r.totalStaff, late: r.staffLate })));
  } catch (e) {
    console.error("[probe] hr summary FAILED:", e instanceof Error ? e.message : String(e));
  }
  try {
    const fin = await financeDb
      .select({ date: finDailySummary.date, brand: finDailySummary.brand, outlet: finDailySummary.outlet, revenue: finDailySummary.revenue, expense: finDailySummary.expense })
      .from(finDailySummary)
      .orderBy(desc(finDailySummary.date))
      .limit(5);
    console.log("[probe] fin_daily_summary rows:", fin.map((r) => ({ date: r.date.toISOString().slice(0, 10), brand: r.brand, outlet: r.outlet, revenue: r.revenue, expense: r.expense })));
  } catch (e) {
    console.error("[probe] fin summary FAILED:", e instanceof Error ? e.message : String(e));
  }

  process.exit(0);
}

function maskUrl(u: string): string {
  return u.replace(/:[^:@/]+@/, ":***@");
}

void main().catch((e) => {
  console.error("[probe] fatal", e);
  process.exit(1);
});