/**
 * Closing cash API.
 *  GET  /api/fin/closing-cash?date=...&outlet_id=...
 *  POST /api/fin/closing-cash {date,outlet_id,physical_cash,opening_cash,...}
 *
 * expected_cash = opening_cash + pos_cash_sales - petty_cash_out
 * cash_difference = physical_cash - expected_cash
 *
 * Cashier records; Finance Admin can approve when difference != 0.
 */
import { and, eq, desc } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { Role } from "@ykp/config";
import { requireRole, can } from "@ykp/auth";
import { finClosingCash } from "@ykp/schema";
import { getMasterDb, getFinanceDb } from "@/lib/server/db.js";
import { handler, ok, fail } from "@/lib/server/http.js";
import { assertOutlet } from "@/lib/server/refs.js";
import { logFinanceAudit } from "@/lib/server/audit.js";
import { financeDayId } from "@ykp/engine";
import { FinClosingQuerySchema, FinClosingCreateSchema } from "@/lib/schemas.js";

export const GET = handler(async (req: NextRequest) => {
  const user = await requireRole([
    Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.BRAND_MANAGER, Role.OUTLET_MANAGER, Role.VIEWER,
  ]);
  void user;
  const search = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = FinClosingQuerySchema.safeParse(search);
  if (!parsed.success) return fail("validation_error", "Invalid query", parsed.error.flatten());

  const { date, outlet_id } = parsed.data;
  const db = getFinanceDb();
  const rows = await db
    .select()
    .from(finClosingCash)
    .where(and(eq(finClosingCash.date, date), eq(finClosingCash.outletId, outlet_id)))
    .orderBy(desc(finClosingCash.createdAt));
  return ok(rows[0] ?? null);
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireRole([Role.OUTLET_MANAGER, Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.STAFF_INPUT]);
  if (!can(user.role, "closing", "update")) {
    return fail("forbidden", "Role cannot record closing cash");
  }

  const body = await req.json();
  const parsed = FinClosingCreateSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid closing payload", parsed.error.flatten());

  const data = parsed.data;
  const masterDb = getMasterDb();
  const financeDb = getFinanceDb();
  await assertOutlet(masterDb, data.outlet_id);

  const expectedCash = data.opening_cash + data.pos_cash_sales - data.petty_cash_out;
  const cashDifference = data.physical_cash - expectedCash;

  // Defect S1 fix: allocate closingId inside a transaction with FOR UPDATE
  // so concurrent POSTs don't collide on the FIN-YYYYMMDD-NNN sequence.
  const closingId = await financeDb.transaction(async (tx) => {
    const existing = await tx
      .select({ count: finClosingCash.closingId })
      .from(finClosingCash)
      .where(eq(finClosingCash.date, data.date))
      .for("update");
    const seq = existing.length + 1;
    return financeDayId(data.date, seq, data.outlet_id);
  });

  const [inserted] = await financeDb
    .insert(finClosingCash)
    .values({
      closingId,
      date: new Date(data.date),
      outletId: data.outlet_id,
      physicalCash: data.physical_cash,
      openingCash: data.opening_cash,
      posCashSales: data.pos_cash_sales,
      cashRevenueIn: data.cash_revenue_in,
      cashExpenseOut: data.cash_expense_out,
      pettyCashOut: data.petty_cash_out,
      expectedCash,
      cashDifference,
      denominationBreakdown: data.denomination_breakdown ?? null,
      recordedBy: user.id,
    })
    .returning();

  await logFinanceAudit(financeDb, {
    actor: user.id,
    action: "closing_cash:recorded",
    entity: "fin_closing_cash",
    entityId: inserted.closingId,
    after: inserted,
  });

  return ok(inserted, 201);
});