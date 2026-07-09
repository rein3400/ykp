/**
 * PATCH /api/fin/supplier/:id — patch paid_amount / notes / attachment / due_date.
 *
 * When paid_amount changes we recompute unpaid_amount + payment_status but
 * DO NOT mark the row paid here — a dedicated /approve-payment endpoint
 * records the Owner/Finance-Admin decision separately. This endpoint is
 * the bookkeeping channel; approval is a separate gate.
 */
import { eq } from "drizzle-orm";
import { Role } from "@ykp/config";
import { requireRole } from "@ykp/auth";
import { finSupplierCost } from "@ykp/schema";
import { getFinanceDb } from "@finance/lib/server/db";
import { handler, ok, fail } from "@finance/lib/server/http";
import { logFinanceAudit } from "@finance/lib/server/audit";
import { FinSupplierPatchSchema } from "@finance/lib/schemas";

export const PATCH = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const user = await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER]);
  const id = ctx.params.id;
  const financeDb = getFinanceDb();

  const existing = await financeDb.select().from(finSupplierCost).where(eq(finSupplierCost.costId, id)).limit(1);
  if (!existing[0]) return fail("not_found", `fin_supplier_cost ${id} not found`);
  const row = existing[0];

  if (row.paymentStatus === "PAID" || row.paymentStatus === "CANCELLED") {
    return fail("conflict", `Cannot patch a ${row.paymentStatus} supplier cost row`);
  }

  const body = await req.json();
  const parsed = FinSupplierPatchSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid patch", parsed.error.flatten());

  const data = parsed.data;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.attachment_url !== undefined) patch.attachmentUrl = data.attachment_url;
  if (data.due_date !== undefined) patch.dueDate = data.due_date ? new Date(data.due_date) : null;

  if (data.paid_amount !== undefined) {
    const paid = data.paid_amount;
    if (paid > row.amount) {
      return fail("validation_error", `paid_amount ${paid} exceeds amount ${row.amount}`);
    }
    const unpaid = row.amount - paid;
    patch.paidAmount = paid;
    patch.unpaidAmount = unpaid;
    patch.paymentStatus = unpaid <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
  }

  const [updated] = await financeDb.update(finSupplierCost).set(patch).where(eq(finSupplierCost.costId, id)).returning();

  await logFinanceAudit(financeDb, {
    actor: user.id,
    action: "fin_supplier_cost:patched",
    entity: "fin_supplier_cost",
    entityId: id,
    before: existing[0],
    after: updated,
  });

  return ok(updated);
});