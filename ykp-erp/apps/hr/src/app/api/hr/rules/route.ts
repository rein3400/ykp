import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  initDbClients,
  createMasterDb,
  hrRules,
} from "@ykp/schema";
import { requireRole, Role } from "@ykp/auth";
import { logAudit, hrRuleId, getOutletName, PrefixIdSequence } from "@ykp/engine";
import { jsonOk, jsonError, handleError } from "@hr/lib/api-error";
import { resolveBody, resolveQuery } from "@hr/lib/zod-resolver";

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

const querySchema = z.object({
  outletId: z.string().optional(),
});

const ruleSchema = z.object({
  outletId: z.string().min(1),
  shiftName: z.string().min(1),
  shiftStart: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
  shiftEnd: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
  lateToleranceMinutes: z.coerce.number().int().min(0).default(15),
  overtimeRateMultiplier: z.coerce.number().positive().default(1.5),
  overtimeDailyCapHours: z.coerce.number().positive().default(4),
  earlyClockinToleranceMin: z.coerce.number().int().min(0).default(30),
  mandatoryCheckout: z.coerce.boolean().default(true),
  payrollPeriodStart: z.coerce.number().int().min(1).max(31).default(1),
  payrollPeriodEnd: z.coerce.number().int().min(1).max(31).default(25),
});

/**
 * GET /api/hr/rules
 * Lists hr_rules per outlet (or all).
 */
export async function GET(req: Request): Promise<Response> {
  boot();
  try {
    await requireRole([Role.OWNER, Role.HR_ADMIN, Role.SUPER_ADMIN, Role.OUTLET_MANAGER, Role.BRAND_MANAGER, Role.VIEWER]);
    const url = new URL(req.url);
    const parsed = resolveQuery(url, querySchema);
    if (parsed instanceof Response) return parsed;

    const masterDb = createMasterDb();
    const rows = await masterDb
      .select()
      .from(hrRules)
      .where(parsed.outletId ? eq(hrRules.outletId, parsed.outletId) : undefined)
      .limit(200);

    return jsonOk({ rules: rows });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/hr/rules
 * Creates a new hr_rules row. Requires HR_ADMIN or SUPER_ADMIN.
 * Validates outlet_id exists in master DB.
 */
export async function POST(req: Request): Promise<Response> {
  boot();
  try {
    const user = await requireRole([Role.OWNER, Role.HR_ADMIN, Role.SUPER_ADMIN]);
    const parsed = await resolveBody(req, ruleSchema);
    if (parsed instanceof Response) return parsed;

    const masterDb = createMasterDb();
    const outletName = await getOutletName(masterDb, parsed.outletId);
    if (outletName === null) return jsonError(400, `outlet_id ${parsed.outletId} not found in master`);

    // Defect H1: hr_rules lives in ykp_master. Sequence + insert run
    // against the master DB, and the audit row is written to master too.
    const existing = await masterDb
      .select({ ruleId: hrRules.ruleId })
      .from(hrRules)
      .where(eq(hrRules.outletId, parsed.outletId));
    const maxSeq = existing.reduce((acc, r) => {
      const m = r.ruleId.match(/-(\d{3,})$/);
      const n = m ? Number.parseInt(m[1], 10) : 0;
      return Number.isFinite(n) && n > acc ? n : acc;
    }, 0);
    const seq = new PrefixIdSequence(`${parsed.outletId}-`, maxSeq);
    const ruleId = hrRuleId(parsed.outletId, seq);

    await masterDb.insert(hrRules).values({
      ruleId,
      outletId: parsed.outletId,
      shiftName: parsed.shiftName,
      shiftStart: parsed.shiftStart,
      shiftEnd: parsed.shiftEnd,
      lateToleranceMinutes: parsed.lateToleranceMinutes,
      overtimeRateMultiplier: parsed.overtimeRateMultiplier as unknown as string,
      overtimeDailyCapHours: parsed.overtimeDailyCapHours as unknown as string,
      earlyClockinToleranceMin: parsed.earlyClockinToleranceMin,
      mandatoryCheckout: parsed.mandatoryCheckout,
      payrollPeriodStart: parsed.payrollPeriodStart,
      payrollPeriodEnd: parsed.payrollPeriodEnd,
    } as typeof hrRules.$inferInsert);

    await logAudit(masterDb, {
      actor: user.id,
      action: "rules:create",
      entity: "hr_rules",
      entityId: ruleId,
      after: parsed,
    }, "master");

    return jsonOk({ ruleId });
  } catch (err) {
    return handleError(err);
  }
}