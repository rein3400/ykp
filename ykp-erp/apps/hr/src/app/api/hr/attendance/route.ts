import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";
import {
  initDbClients,
  createHrDb,
  createMasterDb,
  hrAttendance,
} from "@ykp/schema";
import { requireRole, Role } from "@ykp/auth";
import {
  computeLate,
  computeEarlyLeave,
  computeOvertime,
  getOutletName,
  getEmployeeName,
  getHrRulesForOutlet,
  logAudit,
  uuid,
  todayWib,
} from "@ykp/engine";
import { jsonOk, jsonError, handleError } from "@/lib/api-error";
import { resolveBody, resolveQuery } from "@/lib/zod-resolver";

export const dynamic = "force-dynamic";

// Lazily boot DB clients exactly once per process.
let booted = false;
function boot(): void {
  if (booted) return;
  try {
    initDbClients();
    booted = true;
  } catch {
    // Boot can fail in test envs without DBs; handlers still type-check.
  }
}

const querySchema = z.object({
  date: z.string().optional(),
  outletId: z.string().optional(),
  employeeId: z.string().optional(),
});

const checkinSchema = z.object({
  employeeId: z.string().min(1),
  outletId: z.string().min(1),
  shiftName: z.string().optional(),
  location: z.string().optional(),
});

const checkoutSchema = z.object({
  attendanceId: z.string().min(1),
  location: z.string().optional(),
});

/**
 * GET /api/hr/attendance
 *
 * List attendance rows with optional date / outlet / employee filters.
 * Lookup helpers resolve outlet + employee names so the client UI does
 * not have to call the master DB directly.
 */
export async function GET(req: Request): Promise<Response> {
  boot();
  try {
    await requireRole([Role.OWNER, Role.HR_ADMIN, Role.SUPER_ADMIN, Role.OUTLET_MANAGER, Role.BRAND_MANAGER, Role.VIEWER]);
    const url = new URL(req.url);
    const parsed = resolveQuery(url, querySchema);
    if (parsed instanceof Response) return parsed;

    const hrDb = createHrDb();
    const masterDb = createMasterDb();

    const filters = [];
    if (parsed.date) filters.push(eq(hrAttendance.date, parsed.date));
    if (parsed.outletId) filters.push(eq(hrAttendance.outletId, parsed.outletId));
    if (parsed.employeeId) filters.push(eq(hrAttendance.employeeId, parsed.employeeId));

    const rows = await hrDb
      .select()
      .from(hrAttendance)
      .where(filters.length ? and(...filters) : undefined)
      .limit(500);

    const enriched = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        outletName: await getOutletName(masterDb, r.outletId),
        employeeName: await getEmployeeName(masterDb, r.employeeId),
      })),
    );

    return jsonOk({ attendance: enriched });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/hr/attendance  (action: checkin | checkout)
 *
 * Dispatches by the presence of `attendanceId` on the body:
 *   - body.attendanceId -> checkout
 *   - otherwise          -> checkin
 */
export async function POST(req: Request): Promise<Response> {
  boot();
  try {
    const user = await requireRole([
      Role.OWNER,
      Role.HR_ADMIN,
      Role.SUPER_ADMIN,
      Role.OUTLET_MANAGER,
      Role.STAFF_INPUT,
    ]);

    const raw = (await req.json().catch(() => null)) as
      | (Partial<z.infer<typeof checkinSchema>> & Partial<z.infer<typeof checkoutSchema>>)
      | null;
    if (!raw) return jsonError(400, "Invalid JSON body");

    const hrDb = createHrDb();
    const masterDb = createMasterDb();

    if ("attendanceId" in raw && typeof raw.attendanceId === "string") {
      return handleCheckout(hrDb, masterDb, raw.attendanceId, raw.location, user);
    }
    return handleCheckin(hrDb, masterDb, raw as z.infer<typeof checkinSchema>, user);
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PATCH /api/hr/attendance/[id]
 * Thin wrapper so the table can patch status/notes without re-creating the
 * row. Full PATCH lives in the [id] route handler below.
 */
export async function PATCH(): Promise<Response> {
  return jsonError(400, "Use /api/hr/attendance/[id] for partial updates");
}

// ----- internal handlers ----------------------------------------------------

async function handleCheckin(
  hrDb: ReturnType<typeof createHrDb>,
  masterDb: ReturnType<typeof createMasterDb>,
  body: z.infer<typeof checkinSchema>,
  user: { id: string },
): Promise<Response> {
  const parsed = checkinSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, parsed.error.issues.map((i) => i.message).join("; "));

  const { employeeId, outletId, shiftName, location } = parsed.data;

  // Cross-DB FK validation: employee + outlet must exist in master.
  const empName = await getEmployeeName(masterDb, employeeId);
  if (empName === null) return jsonError(400, `employee_id ${employeeId} not found in master`);
  const outletName = await getOutletName(masterDb, outletId);
  if (outletName === null) return jsonError(400, `outlet_id ${outletId} not found in master`);

  // Defect H1: hr_rules lives in ykp_master, not ykp_hr.
  const rule = await getHrRulesForOutlet(masterDb, outletId, shiftName);
  if (!rule) return jsonError(422, `No hr_rules defined for outlet ${outletId}`);

  const now = new Date();
  const today = todayWib();

  // Defect 2 fix: convert `now` to a Date whose getHours/getMinutes return
  // WIB values, since computeLate reads the local-time clock. On a UTC
  // server (the production target) this matters: without it the late
  // threshold uses UTC hours and is off by 7 hours against the WIB shift
  // schedule stored in hr_rules.
  const wibFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const wibParts: Record<string, string> = {};
  for (const p of wibFmt.formatToParts(now)) wibParts[p.type] = p.value;
  const nowWib = new Date(0);
  nowWib.setUTCHours(
    wibParts.hour === "24" ? 0 : Number(wibParts.hour),
    Number(wibParts.minute),
    Number(wibParts.second),
    0,
  );

  // Defect 8 fix: duplicate checkin guard. Reject before insert instead of
  // letting the unique constraint bubble up as a 500.
  const dupRows = await hrDb
    .select({ attendanceId: hrAttendance.attendanceId })
    .from(hrAttendance)
    .where(
      and(
        eq(hrAttendance.employeeId, employeeId),
        eq(hrAttendance.outletId, outletId),
        eq(hrAttendance.date, today),
      ),
    )
    .limit(1);
  if (dupRows[0]) return jsonError(409, `duplicate_checkin: ${dupRows[0].attendanceId} already checked in for ${today}`);

  const late = computeLate(nowWib, rule.shiftStart, rule.lateToleranceMinutes);

  const attendanceId = `ATT-${uuid()}`;
  await hrDb.insert(hrAttendance).values({
    attendanceId,
    date: today,
    employeeId,
    outletId,
    shiftName: shiftName ?? rule.shiftName,
    checkIn: now,
    checkInLocation: location ?? null,
    isLate: late.is_late,
    lateMinutes: late.late_minutes,
    isEarlyLeave: false,
    overtimeHours: "0",
    attendanceStatus: "present",
    approvedBy: null,
    notes: null,
  });

  await logAudit(hrDb, {
    actor: user.id,
    action: "attendance:checkin",
    entity: "hr_attendance",
    entityId: attendanceId,
    after: { isLate: late.is_late, lateMinutes: late.late_minutes },
  }, "hr");

  return jsonOk({
    attendanceId,
    checkIn: now.toISOString(),
    isLate: late.is_late,
    lateMinutes: late.late_minutes,
  });
}

async function handleCheckout(
  hrDb: ReturnType<typeof createHrDb>,
  masterDb: ReturnType<typeof createMasterDb>,
  attendanceId: string,
  location: string | undefined,
  user: { id: string },
): Promise<Response> {
  const parsed = checkoutSchema.safeParse({ attendanceId, location });
  if (!parsed.success) return jsonError(400, parsed.error.issues.map((i) => i.message).join("; "));

  const rows = await hrDb
    .select()
    .from(hrAttendance)
    .where(eq(hrAttendance.attendanceId, attendanceId))
    .limit(1);
  const row = rows[0];
  if (!row) return jsonError(404, `attendance ${attendanceId} not found`);
  if (row.checkOut) return jsonError(409, `attendance ${attendanceId} already checked out`);

  // Defect H1: hr_rules lives in ykp_master.
  const rule = await getHrRulesForOutlet(masterDb, row.outletId, row.shiftName ?? undefined);
  if (!rule) return jsonError(422, `No hr_rules for outlet ${row.outletId}`);

  const now = new Date();
  // Defect H3: normalize checkout time to WIB the same way checkin does.
  // computeEarlyLeave / computeOvertime read getHours() which on a UTC
  // server is off by 7 hours against the WIB shift_end in hr_rules.
  const wibFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const wibParts: Record<string, string> = {};
  for (const p of wibFmt.formatToParts(now)) wibParts[p.type] = p.value;
  const nowWib = new Date(0);
  nowWib.setUTCHours(
    wibParts.hour === "24" ? 0 : Number(wibParts.hour),
    Number(wibParts.minute),
    Number(wibParts.second),
    0,
  );
  const early = computeEarlyLeave(nowWib, rule.shiftEnd);
  const ot = computeOvertime(nowWib, rule.shiftEnd);

  await hrDb
    .update(hrAttendance)
    .set({
      checkOut: now,
      checkInLocation: location ?? row.checkInLocation,
      isEarlyLeave: early.is_early_leave,
      overtimeHours: String(ot.overtime_hours),
      updatedAt: new Date(),
    })
    .where(eq(hrAttendance.attendanceId, attendanceId));

  await logAudit(hrDb, {
    actor: user.id,
    action: "attendance:checkout",
    entity: "hr_attendance",
    entityId: attendanceId,
    before: { checkOut: null },
    after: { checkOut: now.toISOString(), isEarlyLeave: early.is_early_leave, overtimeHours: ot.overtime_hours },
  }, "hr");

  return jsonOk({
    attendanceId,
    checkOut: now.toISOString(),
    isEarlyLeave: early.is_early_leave,
    overtimeHours: ot.overtime_hours,
  });
}

// Silence "unused import" lint for Next.js response helpers and date range.
void NextResponse;
void gte;
void lte;
void jsonOk;