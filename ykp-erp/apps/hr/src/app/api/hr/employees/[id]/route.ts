import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  initDbClients,
  createMasterDb,
  masterEmployee,
} from "@ykp/schema";
import { requireRole, Role } from "@ykp/auth";
import { logAudit } from "@ykp/engine";
import { jsonOk, jsonError, handleError } from "@hr/lib/api-error";
import { resolveBody } from "@hr/lib/zod-resolver";

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
  status: z.enum(["active", "inactive"]),
});

/**
 * PATCH /api/hr/employees/:id
 * Updates an employee's status (activate / deactivate). The employees-table
 * "Nonaktifkan" action calls this. Requires HR_ADMIN or SUPER_ADMIN.
 * In Next.js 14, ctx.params is a plain object (not a Promise).
 */
export async function PATCH(
  req: Request,
  ctx: { params: { id: string } },
): Promise<Response> {
  boot();
  try {
    const user = await requireRole([Role.OWNER, Role.HR_ADMIN, Role.SUPER_ADMIN]);
    const parsed = await resolveBody(req, patchSchema);
    if (parsed instanceof Response) return parsed;

    const employeeId = ctx.params.id;
    if (!employeeId) return jsonError(400, "employee id is required");

    const masterDb = createMasterDb();
    const existing = await masterDb
      .select()
      .from(masterEmployee)
      .where(eq(masterEmployee.employeeId, employeeId))
      .limit(1);
    const before = existing[0];
    if (!before) return jsonError(404, `employee ${employeeId} not found`);

    const [updated] = await masterDb
      .update(masterEmployee)
      .set({ status: parsed.status, updatedAt: new Date() })
      .where(eq(masterEmployee.employeeId, employeeId))
      .returning();

    await logAudit(masterDb, {
      actor: user.id,
      action: `master_employee:${parsed.status === "inactive" ? "deactivated" : "activated"}`,
      entity: "master_employee",
      entityId: employeeId,
      before: { status: before.status },
      after: { status: parsed.status },
    });

    return jsonOk({ employee: updated });
  } catch (err) {
    return handleError(err);
  }
}
