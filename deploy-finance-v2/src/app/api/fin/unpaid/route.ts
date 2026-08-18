/**
 * GET /api/fin/unpaid — list unpaid supplier cost rows with aging_days.
 * aging_days = today (WIB) - due_date (when due_date present, else use row.date).
 * Filter: only rows whose payment_status is UNPAID, PARTIAL, or OVERDUE.
 */
import { or, eq, lte, sql, desc } from "drizzle-orm";
import { Role } from "../../../../../_packages/config/src";
import { requireRole } from "../../../../../_packages/auth/src";
import { finSupplierCost } from "../../../../../_packages/schema/src";
import { getFinanceDb } from "../../../../lib/server/db";
import { handler, ok } from "../../../../lib/server/http";
import { todayWib } from "../../../../../_packages/engine/src/index";

export const GET = handler(async (req: Request) => {
  await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.BRAND_MANAGER, Role.VIEWER]);
  const db = getFinanceDb();
  const today = todayWib();

  const rows = await db
    .select()
    .from(finSupplierCost)
    .where(
      or(
        eq(finSupplierCost.paymentStatus, "UNPAID"),
        eq(finSupplierCost.paymentStatus, "PARTIAL"),
        eq(finSupplierCost.paymentStatus, "OVERDUE"),
      ),
    )
    .orderBy(desc(finSupplierCost.date));

  const enriched = rows.map((r) => {
    const ref = r.dueDate ?? r.date;
    const refStr = ref instanceof Date ? ref.toISOString().slice(0, 10) : String(ref).slice(0, 10);
    const ms = new Date(today).getTime() - new Date(refStr).getTime();
    const agingDays = Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
    return { ...r, aging_days: agingDays };
  });

  return ok(enriched);
});