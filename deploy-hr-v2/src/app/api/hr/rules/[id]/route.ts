import { z } from "zod";
import { eq } from "drizzle-orm";
import { initDbClients, createMasterDb, hrRules } from "../../../../../../_packages/schema/src/index";
import { requireRole, Role } from "../../../../../../_packages/auth/src/index";
import { logAudit } from "../../../../../../_packages/engine/src/index";
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

    const patch: Record<string, unknown> = {};
    if (parsed.shiftName !== undefined) patch.shiftName = parsed.shiftName;
    if (parsed.shiftStart !== undefined) patch.shiftStart = parsed.shiftStart;
    if (parsed.shiftEnd !== undefined) patch.shiftEnd = parsed.shiftEnd;
    if (parsed.lateToleranceMinutes !== undefined) patch.lateToleranceMinutes = parsed.lateToleranceMinutes;
    if (parsed.overtimeRateMultiplier !== undefined) patch.overtimeRateMultiplier = String(parsed.overtimeRateMultiplier);
    if (parsed.overtimeDailyCapHours !== undefined) patch.overtimeDailyCapHours = String(parsed.overtimeDailyCapHours);
    if (parsed.earlyClockinToleranceMin !== undefined) patch.earlyClockinToleranceMin = parsed.earlyClockinToleranceMin;
    if (parsed.mandatoryCheckout !== undefined) patch.mandatoryCheckout = parsed.mandatoryCheckout;
    if (parsed.payrollPeriodStart !== undefined) patch.payrollPeriodStart = parsed.payrollPeriodStart;
    if (parsed.payrollPeriodEnd !== undefined) patch.payrollPeriodEnd = parsed.payrollPeriodEnd;
    patch.updatedAt = new Date();

    await masterDb
      .update(hrRules)
      .set(patch)
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