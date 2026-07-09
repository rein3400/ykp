/**
 * POST /api/fin/petty-cash/:id/approve — Owner's decision on a PENDING row.
 * Body: { decision: "APPROVE" | "REJECT", reason?: string }
 *
 * Transitions the row's approval_status:
 *   PENDING -> APPROVED  (or REJECTED)
 * and writes an audit row before/after. If APPROVED, payment_status of
 * fin_petty_cash is APPROVED; the row stays in finance as an "approved
 * out" record without further mutation.
 */
import { eq } from "drizzle-orm";
import { Role } from "@ykp/config";
import { requireRole, can } from "@ykp/auth";
import { finPettyCash } from "@ykp/schema";
import { getFinanceDb } from "@finance/lib/server/db";
import { handler, ok, fail } from "@finance/lib/server/http";
import { logFinanceAudit } from "@finance/lib/server/audit";
import { transitionApproval } from "@ykp/engine";
import { FinPettyCashApproveSchema } from "@finance/lib/schemas";

const OWNER_ONLY_THRESHOLD = 5_000_000;

export const POST = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const id = ctx.params.id;
  const financeDb = getFinanceDb();
  const existing = await financeDb.select().from(finPettyCash).where(eq(finPettyCash.pcId, id)).limit(1);
  if (!existing[0]) return fail("not_found", `fin_petty_cash ${id} not found`);

  const row = existing[0];
  // Defect S2 fix: amount > 5jt must be approved by OWNER only.
  const needsOwner = row.amount > OWNER_ONLY_THRESHOLD;
  const user = await requireRole(
    needsOwner
      ? [Role.OWNER]
      : [Role.OWNER, Role.FINANCE_ADMIN, Role.SUPER_ADMIN],
  );
  if (!can(user.role, "petty_cash", "approve")) {
    return fail("forbidden", "Role cannot approve petty cash");
  }

  const body = await req.json();
  const parsed = FinPettyCashApproveSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid approve body", parsed.error.flatten());

  const data = parsed.data;
  const target = data.decision === "APPROVE" ? "APPROVED" : "REJECTED";

  const result = transitionApproval(
    { id: row.pcId, entity: "petty_cash", amount: row.amount, status: row.approvalStatus },
    row.approvalStatus,
    target,
    { id: user.id, role: user.role },
    data.reason,
  );
  if (!result.ok) return fail("approval_required", result.error ?? "Transition not allowed");

  const [updated] = await financeDb
    .update(finPettyCash)
    .set({
      approvalStatus: target,
      approvedBy: data.decision === "APPROVE" ? user.id : null,
      updatedAt: new Date(),
    })
    .where(eq(finPettyCash.pcId, id))
    .returning();

  await logFinanceAudit(financeDb, {
    actor: user.id,
    action: `petty_cash:${target.toLowerCase()}`,
    entity: "fin_petty_cash",
    entityId: id,
    before: row,
    after: updated,
    reason: data.reason,
  });

  return ok(updated);
});