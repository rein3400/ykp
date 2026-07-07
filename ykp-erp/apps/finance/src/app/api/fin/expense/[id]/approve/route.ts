/**
 * POST /api/fin/expense/:id/approve — Owner / Finance Admin approval.
 *
 * Role thresholds (binding contract §7.1):
 *   - amount > 5jt  -> only OWNER can APPROVE
 *   - otherwise      FINANCE_ADMIN / OWNER / SUPER_ADMIN
 *
 * Body: { decision: "APPROVE" | "REJECT", reason?: string }
 */
import { eq } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { Role } from "@ykp/config";
import { requireRole } from "@ykp/auth";
import { finExpense } from "@ykp/schema";
import { getFinanceDb } from "@/lib/server/db.js";
import { handler, ok, fail } from "@/lib/server/http.js";
import { logFinanceAudit } from "@/lib/server/audit.js";
import { transitionApproval } from "@ykp/engine";
import { FinExpenseApproveSchema } from "@/lib/schemas.js";

const OWNER_ONLY_THRESHOLD = 5_000_000;

export const POST = handler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const id = ctx.params.id;
  const financeDb = getFinanceDb();
  const existing = await financeDb.select().from(finExpense).where(eq(finExpense.expenseId, id)).limit(1);
  if (!existing[0]) return fail("not_found", `fin_expense ${id} not found`);

  const row = existing[0];
  const needsOwner = row.amount > OWNER_ONLY_THRESHOLD;
  const user = await requireRole(needsOwner ? [Role.OWNER] : [Role.OWNER, Role.FINANCE_ADMIN, Role.SUPER_ADMIN]);

  const body = await req.json();
  const parsed = FinExpenseApproveSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid approve body", parsed.error.flatten());

  const data = parsed.data;
  // Defect S1 fix: only use parsed.data.decision. The previous implementation
  // fell back to raw body.decision, which bypassed zod validation and let
  // invalid decisions reach the FSM (then crashed or silently mapped to
  // APPROVED via the catch-all else branch).
  // Defect F9 fix: decision enum already covers APPROVE|REJECT|PAID so an
  // already-APPROVED row can be marked PAID through the same endpoint.
  const decision = data.decision as string;
  const target: "APPROVED" | "REJECTED" | "PAID" =
    decision === "PAID" ? "PAID"
    : decision === "REJECT" ? "REJECTED"
    : "APPROVED";

  const result = transitionApproval(
    { id: row.expenseId, entity: "expense", amount: row.amount, status: row.approvalStatus },
    row.approvalStatus,
    target,
    { id: user.id, role: user.role },
    data.reason,
  );
  if (!result.ok) return fail("approval_required", result.error ?? "Transition not allowed");

  const [updated] = await financeDb
    .update(finExpense)
    .set({
      approvalStatus: target,
      approvedBy: target === "APPROVED" || target === "PAID" ? user.id : null,
      updatedAt: new Date(),
    })
    .where(eq(finExpense.expenseId, id))
    .returning();

  await logFinanceAudit(financeDb, {
    actor: user.id,
    action: `expense:${target.toLowerCase()}`,
    entity: "fin_expense",
    entityId: id,
    before: row,
    after: updated,
    reason: data.reason,
  });

  return ok(updated);
});