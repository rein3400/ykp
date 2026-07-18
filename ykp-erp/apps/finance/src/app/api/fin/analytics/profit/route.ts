/**
 * GET /api/fin/analytics/profit?period=...&brand_id=...&outlet_id=...
 *
 * Returns revenue, expense, supplier_cost, petty_cash_out, and net
 * (revenue - expense - supplier_cost - petty_cash_out) for the window.
 */
import { and, eq, gte, lte, notInArray, sql, sum } from "drizzle-orm";
import { Role } from "@ykp/config";
import { requireRole } from "@ykp/auth";
import { finPosDailyView, finExpense, finSupplierCost, finPettyCash } from "@ykp/schema";
import { getFinanceDb } from "@finance/lib/server/db";
import { handler, ok, fail } from "@finance/lib/server/http";
import { todayWib } from "@ykp/engine";
import { FinAnalyticsPeriodSchema } from "@finance/lib/schemas";

function windowFor(period: string): { from: string; to: string } {
  const today = new Date(todayWib());
  const to = today;
  let from = new Date(today);
  switch (period) {
    case "day":
      break;
    case "week":
      from.setDate(today.getDate() - 6);
      break;
    case "month":
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case "quarter":
      from.setDate(today.getDate() - 89);
      break;
    case "year":
      from.setFullYear(today.getFullYear() - 1);
      break;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return { from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`, to: `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}` };
}

async function sumWhere(table: typeof finPosDailyView | typeof finExpense | typeof finSupplierCost | typeof finPettyCash, column: typeof finPosDailyView.netSales | typeof finExpense.amount | typeof finSupplierCost.amount | typeof finPettyCash.amount, conds: ReturnType<typeof eq>[]) {
  const db = getFinanceDb();
  const rows = await db.select({ v: sum(column) }).from(table).where(conds.length ? and(...conds) : undefined);
  return Number(rows[0]?.v ?? 0);
}

export const GET = handler(async (req: Request) => {
  const user = await requireRole([
    Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.BRAND_MANAGER, Role.VIEWER,
  ]);
  void user;
  const search = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = FinAnalyticsPeriodSchema.safeParse(search);
  if (!parsed.success) return fail("validation_error", "Invalid query", parsed.error.flatten());

  const { period, brand_id, outlet_id, date_from, date_to } = parsed.data;
  const win = windowFor(period);
  const from = date_from ?? win.from;
  const to = date_to ?? win.to;

  const posConds = [gte(finPosDailyView.date, new Date(from)), lte(finPosDailyView.date, new Date(to))];
  // Defect F6: exclude CANCELLED/REJECTED rows from cost sums so voided entries
  // do not inflate deductions.
  const expConds = [
    gte(finExpense.date, new Date(from)),
    lte(finExpense.date, new Date(to)),
    notInArray(finExpense.approvalStatus, ["CANCELLED", "REJECTED"]),
  ];
  const supConds = [
    gte(finSupplierCost.date, new Date(from)),
    lte(finSupplierCost.date, new Date(to)),
    notInArray(finSupplierCost.approvalStatus, ["CANCELLED", "REJECTED"]),
  ];
  // Only money leaving the till (type='out') counts toward net profit.
  const pettyConds = [
    gte(finPettyCash.date, new Date(from)),
    lte(finPettyCash.date, new Date(to)),
    eq(finPettyCash.type, "out"),
    notInArray(finPettyCash.approvalStatus, ["CANCELLED", "REJECTED"]),
  ];
  if (brand_id) {
    posConds.push(eq(finPosDailyView.brandId, brand_id));
    expConds.push(eq(finExpense.brandId, brand_id));
    supConds.push(eq(finSupplierCost.brandId, brand_id));
    pettyConds.push(eq(finPettyCash.brandId, brand_id));
  }
  if (outlet_id) {
    posConds.push(eq(finPosDailyView.outletId, outlet_id));
    expConds.push(eq(finExpense.outletId, outlet_id));
    supConds.push(eq(finSupplierCost.outletId, outlet_id));
    pettyConds.push(eq(finPettyCash.outletId, outlet_id));
  }

  const revenue = await sumWhere(finPosDailyView, finPosDailyView.netSales, posConds);
  const expense = await sumWhere(finExpense, finExpense.amount, expConds);
  const supplierCost = await sumWhere(finSupplierCost, finSupplierCost.amount, supConds);
  const pettyCashOut = await sumWhere(finPettyCash, finPettyCash.amount, pettyConds);
  const net = revenue - expense - supplierCost - pettyCashOut;
  void sql;

  return ok({ period, from, to, revenue, expense, supplier_cost: supplierCost, petty_cash_out: pettyCashOut, net });
});