import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { initDbClients, createHrDb, hrPayroll } from "@ykp/schema";
import { requireRole, Role } from "@ykp/auth";
import { transitionApproval, logAudit } from "@ykp/engine";
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

const approveSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "SUBMIT", "PAY", "CANCEL"]),
  reason: z.string().optional(),
});

/**
 * POST /api/hr/payroll/[id]/approve
 *
 * Drives the HR payroll approval FSM (DRAFT -> PENDING -> APPROVED|REJECTED
 * -> PAID) via the shared `transitionApproval` engine. Restricted to
 * OWNER / HR_ADMIN per binding contract.
 */
export async function POST(
  req: Request,
  ctx: { params: { id: string } },
): Promise<Response> {
  boot();
  try {
    const user = await requireRole([Role.OWNER, Role.HR_ADMIN]);
    const parsed = await resolveBody(req, approveSchema);
    if (parsed instanceof Response) return parsed;

    const hrDb = createHrDb();

    // Map client decision to FSM transition.
    const target: "PENDING" | "APPROVED" | "REJECTED" | "PAID" =
      parsed.decision === "APPROVE"
        ? "APPROVED"
        : parsed.decision === "REJECT"
          ? "REJECTED"
          : parsed.decision === "PAY"
            ? "PAID"
            : "PENDING";

    // Defect 7 fix: serialise the FSM transition. The whole transition
    // (read -> validate -> update -> audit) runs inside one transaction
    // holding a per-row advisory lock acquired via pg_advisory_xact_lock,
    // followed by SELECT ... FOR UPDATE on the payroll row. This prevents
    // two concurrent approve requests from both reading DRAFT and both
    // landing APPROVED (or worse, double-advancing to PAID). The advisory
    // lock is released automatically on transaction commit/rollback.
    const lockKey = hash32(ctx.params.id);
    const outcome = await hrDb.transaction(async (tx) => {
      // Acquire the transaction-scoped advisory lock first. Collisions
      // across different payroll ids are harmless — they still serialise.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

      const rows = await tx
        .select()
        .from(hrPayroll)
        .where(eq(hrPayroll.payrollId, ctx.params.id))
        .for("update")
        .limit(1);
      const row = rows[0];
      if (!row) return { kind: "not_found" as const };

      const currentStatus = row.approvalStatus as string;

      const result = transitionApproval(
        {
          id: row.payrollId,
          entity: "payroll",
          amount: row.grossSalary,
          status: currentStatus as never,
          approvedBy: row.approvedBy ?? null,
        },
        currentStatus as never,
        target,
        { id: user.id, role: user.role },
        parsed.reason,
      );

      if (!result.ok) return { kind: "denied" as const, error: result.error ?? "Approval transition denied" };

      await tx
        .update(hrPayroll)
        .set({
          approvalStatus: target,
          approvedBy: result.new_row.approvedBy ?? user.id,
          updatedAt: new Date(),
        })
        .where(eq(hrPayroll.payrollId, ctx.params.id));

      await logAudit(tx, {
        actor: user.id,
        action: result.audit_entry.action,
        entity: "hr_payroll",
        entityId: ctx.params.id,
        before: row,
        after: { approvalStatus: target },
        reason: parsed.reason,
      }, "hr");

      return {
        kind: "ok" as const,
        approvalStatus: target,
        approvedBy: result.new_row.approvedBy,
      };
    });

    if (outcome.kind === "not_found") return jsonError(404, `payroll ${ctx.params.id} not found`);
    if (outcome.kind === "denied") return jsonError(422, outcome.error);

    return jsonOk({
      payrollId: ctx.params.id,
      approvalStatus: outcome.approvalStatus,
      approvedBy: outcome.approvedBy,
    });
  } catch (err) {
    return handleError(err);
  }
}

// Stable 32-bit hash for pg_advisory_xact_lock. Same id always maps to
// the same lock key; collisions across different ids are acceptable
// because each collision still serialises payroll transitions.
function hash32(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}