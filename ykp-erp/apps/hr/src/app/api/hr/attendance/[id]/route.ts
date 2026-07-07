import { z } from "zod";
import { eq } from "drizzle-orm";
import { initDbClients, createHrDb, hrAttendance } from "@ykp/schema";
import { requireRole, Role } from "@ykp/auth";
import { logAudit } from "@ykp/engine";
import { jsonOk, jsonError, handleError } from "@/lib/api-error";
import { resolveBody } from "@/lib/zod-resolver";

export const dynamic = "force-dynamic";

let booted = false;
function boot(): void {
  if (booted) return;
  try {
    initDbClients();
    booted = true;
  } catch {
    // ignore in test env
  }
}

const patchSchema = z.object({
  attendanceStatus: z.enum(["present", "absent", "izin", "sakit", "cuti"]).optional(),
  approvedBy: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * PATCH /api/hr/attendance/[id]
 *
 * Partial update of an attendance row. Used to flip status (izin/sakit),
 * record an approver, or annotate notes. Audit-logs the diff.
 */
export async function PATCH(
  req: Request,
  ctx: { params: { id: string } },
): Promise<Response> {
  boot();
  try {
    const user = await requireRole([Role.OWNER, Role.HR_ADMIN, Role.SUPER_ADMIN, Role.OUTLET_MANAGER]);
    const parsed = await resolveBody(req, patchSchema);
    if (parsed instanceof Response) return parsed;

    const hrDb = createHrDb();
    const rows = await hrDb
      .select()
      .from(hrAttendance)
      .where(eq(hrAttendance.attendanceId, ctx.params.id))
      .limit(1);
    const before = rows[0];
    if (!before) return jsonError(404, `attendance ${ctx.params.id} not found`);

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.attendanceStatus) patch.attendanceStatus = parsed.attendanceStatus;
    if (typeof parsed.approvedBy === "string") patch.approvedBy = parsed.approvedBy;
    if (typeof parsed.notes === "string") patch.notes = parsed.notes;

    await hrDb
      .update(hrAttendance)
      .set(patch)
      .where(eq(hrAttendance.attendanceId, ctx.params.id));

    await logAudit(hrDb, {
      actor: user.id,
      action: "attendance:patch",
      entity: "hr_attendance",
      entityId: ctx.params.id,
      before,
      after: patch,
    }, "hr");

    return jsonOk({ attendanceId: ctx.params.id, updated: patch });
  } catch (err) {
    return handleError(err);
  }
}