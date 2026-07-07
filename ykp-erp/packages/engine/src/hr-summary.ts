/**
 * @ykp/engine/hr-summary
 *
 * Builds the per-outlet hr_daily_summary row for a date. Reads raw
 * attendance from the HR database and resolves brand/outlet labels
 * from the master database. Idempotent: upserts on (date, outlet).
 *
 * The caller MUST pass already-initialised Drizzle clients; the engine
 * does not own connection lifecycle. Returns the upserted row.
 */

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq, sql } from "drizzle-orm";
import { hrAttendance, hrDailySummary, masterOutlet, type HrDailySummary } from "@ykp/schema";
import { getOutletName, getBrandName } from "./lookup.js";
import { hrDailySummaryId } from "./id-gen.js";

type AnyDb = PostgresJsDatabase<Record<string, unknown>>;

export interface HrDailySummaryInput {
  hrDb: AnyDb;
  masterDb: AnyDb;
  /** ISO date string (yyyy-mm-dd) for the day being summarised. */
  date: string;
  /** Outlet id from master.outlet_id. */
  outlet_id: string;
}

/**
 * Generate (and upsert) the hr_daily_summary row for the given date+outlet.
 * Caller should wrap this in a transaction if atomicity across the two
 * DBs is required (cross-DB transactions are not supported by Postgres,
 * so in practice we accept best-effort + reconciliation via Hermez).
 */
export async function generateHrDailySummary(
  input: HrDailySummaryInput,
): Promise<HrDailySummary> {
  const { hrDb, masterDb, date, outlet_id } = input;

  const outletName = await getOutletName(masterDb, outlet_id);
  if (outletName === null) {
    throw new Error(`generateHrDailySummary: outlet ${outlet_id} not found in master`);
  }

  // Resolve brand_id from the outlet row so we can validate it against master_brand.
  const outletMeta = await masterDb
    .select({ brandId: masterOutlet.brandId })
    .from(masterOutlet)
    .where(eq(masterOutlet.outletId, outlet_id))
    .limit(1);
  const brandId = outletMeta[0]?.brandId;
  const brandName = brandId ? await getBrandName(masterDb, brandId) : null;
  if (brandId === undefined || brandName === null) {
    throw new Error(`generateHrDailySummary: brand ${brandId ?? "(missing)"} not found in master`);
  }

  const rows = await hrDb
    .select({
      status: hrAttendance.attendanceStatus,
      isLate: hrAttendance.isLate,
    })
    .from(hrAttendance)
    .where(and(eq(hrAttendance.date, date), eq(hrAttendance.outletId, outlet_id)));

  const totalStaff = rows.length;
  // Present = any of {present, izin, sakit, cuti}; only status="absent" is true absence.
  const presentStatuses = new Set(["present", "izin", "sakit", "cuti"]);
  const staffPresent = rows.filter((r) => presentStatuses.has(r.status)).length;
  const staffLate = rows.filter((r) => r.isLate).length;
  const staffAbsent = rows.filter((r) => r.status === "absent").length;

  const payrollIssue = staffLate > totalStaff * 0.2 ? "late_spike" : "none";
  const majorHrIssue = staffAbsent > 0 ? "absent_present" : "none";
  const recommendedAction = payrollIssue !== "none"
    ? "Tinjau jadwal shift + tegur karyawan terlambat."
    : majorHrIssue !== "none"
      ? "Konfirmasi alasan tidak hadir + cek pengganti shift."
      : null;

  // Defect H7 fix: use the id-gen helper which encodes outletId so daily
  // summaries for different outlets never collide. Sequence stays at 1
  // because (date+outlet) uniquely identifies the row.
  const summaryId = hrDailySummaryId(date, outlet_id, 1);
  const upsertRow = {
    summaryId,
    date: new Date(date),
    brand: brandName,
    outlet: outletName,
    // Defect H2/Z1 fix: persist ID columns for downstream filter + validation.
    brandId,
    outletId: outlet_id,
    totalStaff,
    staffPresent,
    staffLate,
    staffAbsent,
    payrollIssue,
    majorHrIssue,
    recommendedAction,
  };

  await hrDb
    .insert(hrDailySummary)
    .values(upsertRow)
    .onConflictDoUpdate({
      target: [hrDailySummary.date, hrDailySummary.outlet],
      set: {
        brandId: sql`excluded.brand_id`,
        outletId: sql`excluded.outlet_id`,
        totalStaff: sql`excluded.total_staff`,
        staffPresent: sql`excluded.staff_present`,
        staffLate: sql`excluded.staff_late`,
        staffAbsent: sql`excluded.staff_absent`,
        payrollIssue: sql`excluded.payroll_issue`,
        majorHrIssue: sql`excluded.major_hr_issue`,
        recommendedAction: sql`excluded.recommended_action`,
        createdAt: new Date(),
      },
    });

  return upsertRow as unknown as HrDailySummary;
}