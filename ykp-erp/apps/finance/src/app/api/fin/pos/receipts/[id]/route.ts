/**
 * Single POS receipt API.
 *  GET    /api/fin/pos/receipts/:id
 *  DELETE /api/fin/pos/receipts/:id
 */
import { eq } from "drizzle-orm";
import { Role } from "@ykp/config";
import { requireRole } from "@ykp/auth";
import { finPosReceipts } from "@ykp/schema";
import { getFinanceDb } from "@finance/lib/server/db";
import { handler, ok, fail } from "@finance/lib/server/http";
import { logFinanceAudit } from "@finance/lib/server/audit";

export const GET = handler(
  async (req: Request, ctx: { params: { id: string } }) => {
    await requireRole([
      Role.FINANCE_ADMIN,
      Role.SUPER_ADMIN,
      Role.OWNER,
      Role.BRAND_MANAGER,
      Role.OUTLET_MANAGER,
      Role.VIEWER,
    ]);

    const db = getFinanceDb();
    const row = await db
      .select()
      .from(finPosReceipts)
      .where(eq(finPosReceipts.receiptId, ctx.params.id))
      .limit(1);

    if (!row.length) return fail("not_found", "Receipt not found");
    return ok(row[0]);
  },
);

export const DELETE = handler(
  async (req: Request, ctx: { params: { id: string } }) => {
    const user = await requireRole([
      Role.FINANCE_ADMIN,
      Role.SUPER_ADMIN,
      Role.OWNER,
    ]);

    const db = getFinanceDb();
    const row = await db
      .select()
      .from(finPosReceipts)
      .where(eq(finPosReceipts.receiptId, ctx.params.id))
      .limit(1);

    if (!row.length) return fail("not_found", "Receipt not found");

    await db.delete(finPosReceipts).where(eq(finPosReceipts.receiptId, ctx.params.id));

    await logFinanceAudit(db, {
      actor: user.id,
      action: "fin_pos_receipt:deleted",
      entity: "fin_pos_receipts",
      entityId: ctx.params.id,
      before: row[0],
    });

    return ok({ receipt_id: ctx.params.id });
  },
);
