/**
 * @ykp/engine/fin-summary
 *
 * Builds the per-outlet fin_daily_summary row for a date. Reads:
 *   - fin_pos_daily.net_sales                 (revenue)
 *   - fin_expense.amount                       (expense)
 *   - fin_supplier_cost.amount + unpaid_amount (supplier_cost, unpaid_supplier)
 *   - fin_petty_cash.amount WHERE type='out'   (petty_cash_out)
 *   - fin_closing_cash.cash_difference         (cash_difference)
 *
 * Formula (binding contract):
 *   net_profit_estimate = revenue - expense - supplier_cost - petty_cash_out
 *
 * Idempotent: upserts on (date, outlet).
 */

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq, lte, sql, desc } from "drizzle-orm";
import {
  finPosDaily,
  finExpense,
  finSupplierCost,
  finPettyCash,
  finClosingCash,
  finDailySummary,
  masterOutlet,
  type FinDailySummary,
} from "../../schema/src/index";
import { getOutletName, getBrandName } from './lookup';
import { financeDayId } from './id-gen';

type AnyDb = PostgresJsDatabase<Record<string, unknown>>;

export interface FinDailySummaryInput {
  financeDb: AnyDb;
  masterDb: AnyDb;
  date: string;
  outlet_id: string;
}

export async function generateFinDailySummary(input: FinDailySummaryInput): Promise<FinDailySummary> {
  const { financeDb, masterDb, date, outlet_id } = input;

  const outletName = await getOutletName(masterDb, outlet_id);
  if (outletName === null) {
    throw new Error(`generateFinDailySummary: outlet ${outlet_id} not found in master`);
  }

  const outletMeta = await masterDb
    .select({ brandId: masterOutlet.brandId })
    .from(masterOutlet)
    .where(eq(masterOutlet.outletId, outlet_id))
    .limit(1);
  const brandId = outletMeta[0]?.brandId;
  const brandName = brandId ? await getBrandName(masterDb, brandId) : null;
  if (brandId === undefined || brandName === null) {
    throw new Error(`generateFinDailySummary: brand ${brandId ?? "(missing)"} not found in master`);
  }

  const revenueRows = await financeDb
    .select({ value: finPosDaily.netSales })
    .from(finPosDaily)
    .where(and(eq(finPosDaily.date, new Date(date)), eq(finPosDaily.outletId, outlet_id)));
  const revenue = revenueRows.reduce((acc, r) => acc + (r.value ?? 0), 0);

  const expenseRows = await financeDb
    .select({ value: finExpense.amount })
    .from(finExpense)
    .where(and(eq(finExpense.date, new Date(date)), eq(finExpense.outletId, outlet_id)));
  const expense = expenseRows.reduce((acc, r) => acc + (r.value ?? 0), 0);

  const supplierRows = await financeDb
    .select({ amount: finSupplierCost.amount, unpaid: finSupplierCost.unpaidAmount, status: finSupplierCost.paymentStatus })
    .from(finSupplierCost)
    .where(and(eq(finSupplierCost.date, new Date(date)), eq(finSupplierCost.outletId, outlet_id)));
  const supplierCost = supplierRows.reduce((acc, r) => acc + (r.amount ?? 0), 0);

  const unpaidRows = await financeDb
    .select({ unpaid: finSupplierCost.unpaidAmount })
    .from(finSupplierCost)
    .where(and(
      eq(finSupplierCost.outletId, outlet_id),
      lte(finSupplierCost.date, new Date(date)),
    ));
  const unpaidSupplier = unpaidRows
    .filter((r) => r.unpaid != null && (r.unpaid as number) > 0)
    .reduce((acc, r) => acc + ((r.unpaid as number) ?? 0), 0);

  const pettyRows = await financeDb
    .select({ value: finPettyCash.amount })
    .from(finPettyCash)
    .where(and(eq(finPettyCash.date, new Date(date)), eq(finPettyCash.outletId, outlet_id), eq(finPettyCash.type, "out")));
  const pettyCashOut = pettyRows.reduce((acc, r) => acc + (r.value ?? 0), 0);

  const closingRows = await financeDb
    .select({ value: finClosingCash.cashDifference })
    .from(finClosingCash)
    .where(and(eq(finClosingCash.date, new Date(date)), eq(finClosingCash.outletId, outlet_id)))
    .orderBy(desc(finClosingCash.recordedAt))
    .limit(1);
  const cashDifference = closingRows[0]?.value ?? 0;

  const net_profit_estimate = revenue - expense - supplierCost - pettyCashOut;

  const majorFinanceIssue =
    cashDifference !== 0 ? "cash_difference"
    : unpaidSupplier > 0 ? "unpaid_supplier"
    : expense > revenue * 0.5 ? "high_expense_ratio"
    : "none";

  const recommendedAction =
    majorFinanceIssue === "cash_difference"
      ? "Audit kas fisik vs sistem; rekonsiliasi dengan kasir."
      : majorFinanceIssue === "unpaid_supplier"
        ? "Cek tagihan jatuh tempo + jadwalkan pembayaran."
        : majorFinanceIssue === "high_expense_ratio"
          ? "Tinjau kategori expense terbesar; cek margin outlet."
          : null;

  // Defect H7 fix: encode outletId via financeDayId so daily summaries for
  // different outlets on the same date never collide.
  const summaryId = financeDayId(date, 1, outlet_id);
  const upsertRow = {
    summaryId,
    date: new Date(date),
    brand: brandName,
    outlet: outletName,
    // Defect H2/Z1 fix: persist ID columns for downstream filter + validation.
    brandId,
    outletId: outlet_id,
    revenue,
    expense,
    supplierCost,
    pettyCashOut,
    unpaidSupplier,
    cashDifference,
    netProfitEstimate: net_profit_estimate,
    majorFinanceIssue,
    recommendedAction,
  };

  await financeDb
    .insert(finDailySummary)
    .values(upsertRow)
    .onConflictDoUpdate({
      target: [finDailySummary.date, finDailySummary.outlet],
      set: {
        brandId: sql`excluded.brand_id`,
        outletId: sql`excluded.outlet_id`,
        revenue: sql`excluded.revenue`,
        expense: sql`excluded.expense`,
        supplierCost: sql`excluded.supplier_cost`,
        pettyCashOut: sql`excluded.petty_cash_out`,
        unpaidSupplier: sql`excluded.unpaid_supplier`,
        cashDifference: sql`excluded.cash_difference`,
        netProfitEstimate: sql`excluded.net_profit_estimate`,
        majorFinanceIssue: sql`excluded.major_finance_issue`,
        recommendedAction: sql`excluded.recommended_action`,
        createdAt: new Date(),
      },
    });

  return upsertRow as unknown as FinDailySummary;
}