import { z } from "zod";
import { eq } from "drizzle-orm";
import { initDbClients, createMasterDb, hrRules } from "@ykp/schema";
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
  shiftName: z.string().optional(),
  shiftStart: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm").optional(),
  shiftEnd: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm").optional(),
  lateToleranceMinutes: z.coerce.number().int().min(0).optional(),
  overtimeRateMultiplier: z.coerce.number().positive().optional(),
  overtimeDailyCapHours: z.coerce.number().positive().optional(),
  earlyClockinToleranceMin: z.coerce.number().int().min(0).optional(),
  mandatoryCheckout: z.coerce.boolean().optional(),
  payrollPeriodStart: z.coerce.number().int().min(1).max(31).optional(),
  payrollPeriodEnd: z.coerce.number().int().min(1).max(31).optional(),
});

/**
 * PATCH /api/hr/rules/[id]
 * Partial update of a rule row. Audit-logs the diff.
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

    const masterDb = createMasterDb();
    const rows = await masterDb
      .select()
      .from(hrRules)
      .where(eq(hrRules.ruleId, ctx.params.id))
      .limit(1);
    const before = rows[0];
    if (!before) return jsonError(404, `rule ${ctx.params.id} not found`);

    await masterDb
      .update(hrRules)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(hrRules.ruleId, ctx.params.id));

    await logAudit(masterDb, {
      actor: user.id,
      action: "rules:patch",
      entity: "hr_rules",
      entityId: ctx.params.id,
      before,
      after: parsed,
    }, "master");

    return jsonOk({ ruleId: ctx.params.id, updated: parsed });
  } catch (err) {
    return handleError(err);
  }
}