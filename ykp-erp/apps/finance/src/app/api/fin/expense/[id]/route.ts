/**
 * PATCH /api/fin/expense/:id — partial update of an expense row.
 * Finance Admin / Super Admin / Owner only.
 */
import { eq } from "drizzle-orm";
import { Role } from "@ykp/config";
import { requireRole } from "@ykp/auth";
import { finExpense } from "@ykp/schema";
import { getFinanceDb } from "@finance/lib/server/db";
import { handler, ok, fail } from "@finance/lib/server/http";
import { logFinanceAudit } from "@finance/lib/server/audit";
import { FinExpensePatchSchema } from "@finance/lib/schemas";

export const PATCH = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const user = await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER]);
  const id = ctx.params.id;
  const financeDb = getFinanceDb();

  const existing = await financeDb.select().from(finExpense).where(eq(finExpense.expenseId, id)).limit(1);
  if (!existing[0]) return fail("not_found", `fin_expense ${id} not found`);
  const row = existing[0];

  if (row.approvalStatus === "PAID" || row.approvalStatus === "CANCELLED") {
    return fail("conflict", `Cannot patch a ${row.approvalStatus} expense row`);
  }

  const body = await req.json();
  const parsed = FinExpensePatchSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid patch", parsed.error.flatten());

  const data = parsed.data;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (data.description !== undefined) patch.description = data.description;
  if (data.amount !== undefined) patch.amount = data.amount;
  if (data.attachment_url !== undefined) patch.attachmentUrl = data.attachment_url;
  if (data.notes !== undefined) patch.notes = data.notes;

  const [updated] = await financeDb.update(finExpense).set(patch).where(eq(finExpense.expenseId, id)).returning();

  await logFinanceAudit(financeDb, {
    actor: user.id,
    action: "expense:patched",
    entity: "fin_expense",
    entityId: id,
    before: existing[0],
    after: updated,
  });

  return ok(updated);
});