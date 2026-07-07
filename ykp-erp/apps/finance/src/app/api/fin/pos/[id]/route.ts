/**
 * PATCH /api/fin/pos/:id — partial update to a POS daily row.
 * Only Finance Admin / Super Admin / Owner can patch.
 */
import { eq, and } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { Role } from "@ykp/config";
import { requireRole } from "@ykp/auth";
import { finPosDaily } from "@ykp/schema";
import { getFinanceDb } from "@/lib/server/db.js";
import { handler, ok, fail } from "@/lib/server/http.js";
import { logFinanceAudit } from "@/lib/server/audit.js";
import { FinPosPatchSchema } from "@/lib/schemas.js";

export const PATCH = handler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER]);
  const id = ctx.params.id;
  const financeDb = getFinanceDb();

  const existing = await financeDb.select().from(finPosDaily).where(eq(finPosDaily.posId, id)).limit(1);
  if (!existing[0]) return fail("not_found", `fin_pos_daily ${id} not found`);

  const body = await req.json();
  const parsed = FinPosPatchSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid patch payload", parsed.error.flatten());

  const data = parsed.data;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (data.cashier !== undefined) patch.cashier = data.cashier;
  if (data.shift !== undefined) patch.shift = data.shift;
  if (data.source !== undefined) patch.source = data.source;
  if (data.source_ref !== undefined) patch.sourceRef = data.source_ref;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.verified_by !== undefined) patch.verifiedBy = data.verified_by;

  if (data.gross_sales !== undefined || data.discount !== undefined || data.refund !== undefined || data.void_amount !== undefined || data.transaction_count !== undefined) {
    const gross = data.gross_sales ?? existing[0].grossSales;
    const discount = data.discount ?? existing[0].discount;
    const refund = data.refund ?? existing[0].refund;
    const voidAmt = data.void_amount ?? existing[0].void;
    const tax = data.tax ?? existing[0].tax;
    const serviceCharge = data.service_charge ?? existing[0].serviceCharge;
    const txCount = data.transaction_count ?? existing[0].transactionCount;
    patch.grossSales = gross;
    patch.discount = discount;
    patch.refund = refund;
    patch.void = voidAmt;
    patch.tax = tax;
    patch.serviceCharge = serviceCharge;
    patch.transactionCount = txCount;
    patch.netSales = gross - discount - refund - voidAmt;
    patch.aov = txCount > 0 ? Math.round((patch.netSales as number) / txCount) : 0;
  }

  const [updated] = await financeDb.update(finPosDaily).set(patch).where(eq(finPosDaily.posId, id)).returning();

  await logFinanceAudit(financeDb, {
    actor: user.id,
    action: "fin_pos_daily:patched",
    entity: "fin_pos_daily",
    entityId: id,
    before: existing[0],
    after: updated,
  });

  return ok(updated);
});