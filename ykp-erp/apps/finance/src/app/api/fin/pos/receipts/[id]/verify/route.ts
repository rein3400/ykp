/**
 * POST /api/fin/pos/receipts/:id/verify — mark a receipt as verified.
 */
import { eq } from "drizzle-orm";
import { Role } from "@ykp/config";
import { requireRole } from "@ykp/auth";
import { finPosReceipts } from "@ykp/schema";
import { getFinanceDb } from "@finance/lib/server/db";
import { handler, ok, fail } from "@finance/lib/server/http";
import { logFinanceAudit } from "@finance/lib/server/audit";

export const POST = handler(
  async (req: Request, ctx: { params: { id: string } }) => {
    const user = await requireRole([
      Role.FINANCE_ADMIN,
      Role.SUPER_ADMIN,
      Role.OWNER,
    ]);

    const db = getFinanceDb();
    const [updated] = await db
      .update(finPosReceipts)
      .set({
        verifiedBy: user.id,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(finPosReceipts.receiptId, ctx.params.id))
      .returning();

    if (!updated) return fail("not_found", "Receipt not found");

    await logFinanceAudit(db, {
      actor: user.id,
      action: "fin_pos_receipt:verified",
      entity: "fin_pos_receipts",
      entityId: ctx.params.id,
      after: updated,
    });

    return ok(updated);
  },
);
