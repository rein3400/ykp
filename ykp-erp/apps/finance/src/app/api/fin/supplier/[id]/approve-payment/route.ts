/**
 * POST /api/fin/supplier/:id/approve-payment
 *
 * Records the formal payment approval decision by Owner or Finance Admin.
 * Updates paid_amount + payment_status (PAID if fully, PARTIAL if partial)
 * and logs an audit entry capturing the before/after snapshot.
 *
 * Body: { decision: "APPROVE" | "REJECT", paid_amount?, reason? }
 */
import { eq } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { Role } from "@ykp/config";
import { requireRole, can } from "@ykp/auth";
import { finSupplierCost } from "@ykp/schema";
import { getFinanceDb } from "@/lib/server/db.js";
import { handler, ok, fail } from "@/lib/server/http.js";
import { logFinanceAudit } from "@/lib/server/audit.js";
import { transitionApproval } from "@ykp/engine";
import { FinSupplierApprovePaymentSchema } from "@/lib/schemas.js";

const OWNER_ONLY_THRESHOLD = 5_000_000;

export const POST = handler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireRole([Role.OWNER, Role.FINANCE_ADMIN, Role.SUPER_ADMIN]);
  if (!can(user.role, "approval", "approve")) {
    return fail("forbidden", "You cannot approve supplier payments");
  }
  const id = ctx.params.id;
  const financeDb = getFinanceDb();

  const existing = await financeDb.select().from(finSupplierCost).where(eq(finSupplierCost.costId, id)).limit(1);
  if (!existing[0]) return fail("not_found", `fin_supplier_cost ${id} not found`);

  const body = await req.json();
  const parsed = FinSupplierApprovePaymentSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid approve body", parsed.error.flatten());

  const data = parsed.data;
  const row = existing[0];
  const approvalStatus = (row as { approvalStatus?: string }).approvalStatus ?? "PENDING";

  // Defect F6 fix: REJECT only allowed from PENDING.
  if (data.decision === "REJECT") {
    if (approvalStatus !== "PENDING") {
      return fail("conflict", `Cannot reject supplier cost in ${approvalStatus} state (PENDING required)`);
    }
    const transition = transitionApproval(
      { id: row.costId, entity: "supplier_cost", amount: row.amount, status: approvalStatus as "PENDING" },
      approvalStatus as "PENDING",
      "REJECTED",
      { id: user.id, role: user.role },
      data.reason,
    );
    if (!transition.ok) return fail("approval_required", transition.error ?? "Reject transition not allowed");

    const [updated] = await financeDb
      .update(finSupplierCost)
      .set({
        approvalStatus: "REJECTED",
        notes: [row.notes ?? "", `[${user.id}] rejected: ${data.reason ?? ""}`].join("\n").trim(),
        updatedAt: new Date(),
      })
      .where(eq(finSupplierCost.costId, id))
      .returning();

    await logFinanceAudit(financeDb, {
      actor: user.id,
      action: "fin_supplier_cost:payment_rejected",
      entity: "fin_supplier_cost",
      entityId: id,
      before: row,
      after: updated,
      reason: data.reason,
    });
    return ok(updated);
  }

  // Defect S2 fix: amount > 5jt requires OWNER only.
  if (row.amount > OWNER_ONLY_THRESHOLD && user.role === Role.FINANCE_ADMIN) {
    return fail("forbidden", "Supplier cost > 5jt requires OWNER role");
  }

  // APPROVE branch — F4/F5: enforce approval_status FSM.
  if (approvalStatus === "PAID" || approvalStatus === "CANCELLED" || approvalStatus === "REJECTED") {
    return fail("conflict", `Cannot approve supplier cost in ${approvalStatus} state`);
  }

  // F5: if row was DRAFT, transition DRAFT->PENDING first, then PENDING->APPROVED.
  // Default supplier POST is PENDING, so the common path is direct PENDING->APPROVED.
  let preTransition = { ok: true } as const;
  if (approvalStatus === "DRAFT") {
    const t = transitionApproval(
      { id: row.costId, entity: "supplier_cost", amount: row.amount, status: "DRAFT" },
      "DRAFT",
      "PENDING",
      { id: user.id, role: user.role },
      data.reason,
    );
    if (!t.ok) return fail("approval_required", t.error ?? "DRAFT->PENDING transition not allowed");
    preTransition = t;
  }
  const approveFrom = approvalStatus === "DRAFT" ? "PENDING" : approvalStatus;
  const transition = transitionApproval(
    { id: row.costId, entity: "supplier_cost", amount: row.amount, status: approveFrom as "PENDING" },
    approveFrom as "PENDING",
    "APPROVED",
    { id: user.id, role: user.role },
    data.reason,
  );
  if (!transition.ok) return fail("approval_required", transition.error ?? "Approve transition not allowed");

  const paidAmount = data.paid_amount ?? row.paidAmount;
  const unpaid = row.amount - paidAmount;
  const paymentStatus: typeof row.paymentStatus = unpaid <= 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID";

  const [updated] = await financeDb
    .update(finSupplierCost)
    .set({
      approvalStatus: "APPROVED",
      paidAmount,
      unpaidAmount: unpaid,
      paymentStatus,
      notes: [row.notes ?? "", `[${user.id}] approved: ${data.reason ?? ""}`].join("\n").trim(),
      updatedAt: new Date(),
    })
    .where(eq(finSupplierCost.costId, id))
    .returning();

  void preTransition;

  await logFinanceAudit(financeDb, {
    actor: user.id,
    action: "fin_supplier_cost:payment_approved",
    entity: "fin_supplier_cost",
    entityId: id,
    before: row,
    after: updated,
    reason: data.reason,
  });

  return ok(updated);
});