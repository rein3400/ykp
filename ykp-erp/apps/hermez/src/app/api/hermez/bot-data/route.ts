import { createHermezDb, createHrDb, createFinanceDb, hermezDailyBrief, hermezAlertLog, hrDailySummary, finDailySummary } from "@ykp/schema";
import { desc, eq } from "drizzle-orm";
import { generateBriefForDate } from "@ykp/engine/hermez-brief";
import { ok, fail } from "../_helpers";

export const dynamic = "force-dynamic";

/**
 * Internal data feed for the co-located telegram bot worker. The worker is a
 * plain Node process (no @ykp/* workspace resolution), so it calls this HTTP
 * endpoint instead of importing the DB layer. Protected by a shared secret
 * (x-bot-secret) — set HERMEZ_BOT_SECRET in the env; the worker sends it back.
 * Not part of the public API surface.
 */
export async function GET(req: Request) {
  const secret = process.env.HERMEZ_BOT_SECRET ?? "";
  const header = req.headers.get("x-bot-secret") ?? "";
  if (!secret || header !== secret) {
    return fail("unauthorized", "Unauthorized", 401);
  }

  const url = new URL(req.url);
  const cmd = url.searchParams.get("cmd") ?? "";
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  try {
    if (cmd === "brief") {
      const db = createHermezDb();
      const rows = await db.select().from(hermezDailyBrief).where(eq(hermezDailyBrief.date, new Date(date))).limit(1);
      const brief = rows[0];
      return ok({ text: brief ? brief.briefText : `Belum ada brief untuk ${date}. Generate via Run Console.` });
    }

    if (cmd === "omzet") {
      const db = createFinanceDb();
      const rows = await db
        .select({ outlet: finDailySummary.outlet, revenue: finDailySummary.revenue, expense: finDailySummary.expense })
        .from(finDailySummary)
        .where(eq(finDailySummary.date, new Date(date)));
      if (!rows.length) return ok({ text: `Tidak ada data finance untuk ${date}.` });
      const fmt = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;
      const totalRev = rows.reduce((a, r) => a + (r.revenue ?? 0), 0);
      const totalExp = rows.reduce((a, r) => a + (r.expense ?? 0), 0);
      const lines = rows.sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0)).map((r) => `${r.outlet}: ${fmt(r.revenue ?? 0)}`);
      return ok({ text: [`OMZET ${date}`, ...lines, `Total: ${fmt(totalRev)}`, `Expense: ${fmt(totalExp)}`, `Net estimate: ${fmt(totalRev - totalExp)}`].join("\n") });
    }

    if (cmd === "hr") {
      const db = createHrDb();
      const rows = await db
        .select({ outlet: hrDailySummary.outlet, total: hrDailySummary.totalStaff, present: hrDailySummary.staffPresent, late: hrDailySummary.staffLate, absent: hrDailySummary.staffAbsent })
        .from(hrDailySummary)
        .where(eq(hrDailySummary.date, new Date(date)));
      if (!rows.length) return ok({ text: `Tidak ada data HR untuk ${date}.` });
      const lines = rows.map((r) => `${r.outlet}: hadir ${r.present}/${r.total}, telat ${r.late}, absen ${r.absent}`);
      return ok({ text: [`HR ${date}`, ...lines, `Total telat: ${rows.reduce((a, r) => a + (r.late ?? 0), 0)}, absen: ${rows.reduce((a, r) => a + (r.absent ?? 0), 0)}`].join("\n") });
    }

    if (cmd === "alerts") {
      const db = createHermezDb();
      const rows = await db.select().from(hermezAlertLog).where(eq(hermezAlertLog.status, "open")).orderBy(desc(hermezAlertLog.createdAt)).limit(10);
      if (!rows.length) return ok({ text: "Tidak ada alert open. Semua bersih." });
      const lines = rows.map((a, i) => `${i + 1}. [${String(a.severity).toUpperCase()}] ${a.alertType} — ${a.message.slice(0, 120)}`);
      return ok({ text: [`ALERT OPEN (${rows.length})`, ...lines].join("\n") });
    }

    if (cmd === "context") {
      // Compact context for the LLM dialog.
      const fmt = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;
      const [hr, fin, alerts] = await Promise.all([
        createHrDb().select({ present: hrDailySummary.staffPresent, late: hrDailySummary.staffLate, absent: hrDailySummary.staffAbsent, total: hrDailySummary.totalStaff }).from(hrDailySummary).where(eq(hrDailySummary.date, new Date(date))).catch(() => [] as { present: number; late: number; absent: number; total: number }[]),
        createFinanceDb().select({ outlet: finDailySummary.outlet, revenue: finDailySummary.revenue }).from(finDailySummary).where(eq(finDailySummary.date, new Date(date))).catch(() => [] as { outlet: string; revenue: number }[]),
        createHermezDb().select().from(hermezAlertLog).where(eq(hermezAlertLog.status, "open")).catch(() => [] as unknown[]),
      ]);
      const parts: string[] = [`Tanggal: ${date}`];
      if (fin.length) {
        parts.push(`Omzet total: ${fmt(fin.reduce((a, r) => a + (r.revenue ?? 0), 0))} dari ${fin.length} outlet`);
        parts.push(fin.map((r) => `  ${r.outlet}: ${fmt(r.revenue ?? 0)}`).join("\n"));
      } else parts.push("Omzet: tidak ada data hari ini");
      if (hr.length) {
        parts.push(`Kehadiran: ${hr.reduce((a, r) => a + (r.present ?? 0), 0)}/${hr.reduce((a, r) => a + (r.total ?? 0), 0)} hadir, ${hr.reduce((a, r) => a + (r.late ?? 0), 0)} telat, ${hr.reduce((a, r) => a + (r.absent ?? 0), 0)} absen`);
      } else parts.push("HR: tidak ada data hari ini");
      parts.push(`Alert open: ${alerts.length}`);
      return ok({ text: parts.join("\n") });
    }

    return fail("validation", `unknown cmd: ${cmd}`, 400);
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("[bot-data]", e);
    return fail("server", "Internal server error", 500);
  }
}

// Reference engine import to keep bundler aware generateBriefForDate exists
// (not used here; brief text comes from the stored hermez_daily_brief row).
void generateBriefForDate;
