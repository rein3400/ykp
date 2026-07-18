/**
 * @ykp/engine/fin-summary
 *
 * Builds the per-outlet fin_daily_summary row for a date. Reads:
 *   - fin_pos_daily_view.net_sales            (revenue, aggregated from receipts)
 *   - fin_expense.amount                       (expense)
 *   - fin_supplier_cost.amount + unpaid_amount (supplier_cost, unpaid_supplier)
 *   - fin_petty_cash.amount WHERE type='out'   (petty_cash_out)
 *   - fin_closing_cash.cash_difference         (cash_difference)
 *
 * Formula (binding contract):
 *   estimated_operating_result = revenue - expense - supplier_cost - petty_cash_out
 *
 * ⚠ This is NOT "Net Profit" — it does not account for:
 *   - Inventory (opening/closing stock → actual COGS)
 *   - Cross-transaction deduplication (petty cash may pay suppliers/expenses)
 *   - Depreciation, tax, or non-operating items
 * Label it "Estimated Operating Result" or "Estimated Cash Surplus" in the UI.
 *
 * Idempotent: upserts on (date, outlet).
 */

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq, lte, sql, desc } from "drizzle-orm";
import {
  finPosDailyView,
  finExpense,
  finSupplierCost,
  finPettyCash,
  finClosingCash,
  finDailySummary,
  masterOutlet,
  type FinDailySummary,
} from "@ykp/schema";
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
    .select({ value: finPosDailyView.netSales })
    .from(finPosDailyView)
    .where(and(eq(finPosDailyView.date, new Date(date)), eq(finPosDailyView.outletId, outlet_id)));
  const revenue = revenueRows.reduce((acc, r) => acc + (r.value ?? 0), 0);

  // POS settlement validation: sum(payment_method_breakdown) vs netSales.
  // A non-zero settlementDifference means tender totals do not reconcile to net sales.
  const breakdownRows = await financeDb
    .select({ breakdown: finPosDailyView.paymentMethodBreakdown })
    .from(finPosDailyView)
    .where(and(eq(finPosDailyView.date, new Date(date)), eq(finPosDailyView.outletId, outlet_id)));
  const paymentMethodsSum = breakdownRows.reduce((acc, r) => {
    const breakdown = (r.breakdown ?? {}) as Record<string, unknown>;
    const methodTotal = Object.values(breakdown).reduce<number>((sum, v) => {
      const n = typeof v === "number" ? v : Number(v);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
    return acc + methodTotal;
  }, 0);
  // Spec: only set settlementDifference when sum(payment_methods) differs from netSales.
  // Use absolute difference so under- and over-settlement both flag; signed as netSales - sum.
  const rawSettlementDiff = revenue - paymentMethodsSum;
  const settlementDifference = rawSettlementDiff !== 0 ? rawSettlementDiff : 0;

  // Revisi item 4 — skip rows that are already counted via a linked counterpart
  // to prevent double counting (e.g. expense paid via petty cash should not
  // appear in both expense AND petty_cash_out).
  const expenseRows = await financeDb
    .select({
      value: finExpense.amount,
      linkedPettyCashId: finExpense.linkedPettyCashId,
      linkedSupplierInvoiceId: finExpense.linkedSupplierInvoiceId,
    })
    .from(finExpense)
    .where(and(eq(finExpense.date, new Date(date)), eq(finExpense.outletId, outlet_id)));
  // If expense is linked to petty cash or supplier invoice, keep it in expense
  // but exclude the linked side from its own sum (see petty/supplier below).
  const expense = expenseRows.reduce((acc, r) => acc + (r.value ?? 0), 0);

  const supplierRows = await financeDb
    .select({
      amount: finSupplierCost.amount,
      unpaid: finSupplierCost.unpaidAmount,
      status: finSupplierCost.paymentStatus,
      linkedPettyCashId: finSupplierCost.linkedPettyCashId,
      linkedExpenseId: finSupplierCost.linkedExpenseId,
    })
    .from(finSupplierCost)
    .where(and(eq(finSupplierCost.date, new Date(date)), eq(finSupplierCost.outletId, outlet_id)));
  // Skip supplier cost already represented as expense (linked_expense_id set)
  const supplierCost = supplierRows
    .filter((r) => !r.linkedExpenseId)
    .reduce((acc, r) => acc + (r.amount ?? 0), 0);

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
    .select({
      value: finPettyCash.amount,
      linkedExpenseId: finPettyCash.linkedExpenseId,
      linkedSupplierInvoiceId: finPettyCash.linkedSupplierInvoiceId,
    })
    .from(finPettyCash)
    .where(and(eq(finPettyCash.date, new Date(date)), eq(finPettyCash.outletId, outlet_id), eq(finPettyCash.type, "out")));
  // Skip petty cash that is a payment vehicle for expense/supplier already counted
  const pettyCashOut = pettyRows
    .filter((r) => !r.linkedExpenseId && !r.linkedSupplierInvoiceId)
    .reduce((acc, r) => acc + (r.value ?? 0), 0);

  const closingRows = await financeDb
    .select({ value: finClosingCash.cashDifference })
    .from(finClosingCash)
    .where(and(eq(finClosingCash.date, new Date(date)), eq(finClosingCash.outletId, outlet_id)))
    .orderBy(desc(finClosingCash.recordedAt))
    .limit(1);
  const cashDifference = closingRows[0]?.value ?? 0;

  const estimated_operating_result = revenue - expense - supplierCost - pettyCashOut;

  // Priority: cash_difference > settlement_mismatch > unpaid_supplier > high_expense_ratio
  const majorFinanceIssue =
    cashDifference !== 0 ? "cash_difference"
    : settlementDifference !== 0 ? "settlement_mismatch"
    : unpaidSupplier > 0 ? "unpaid_supplier"
    : expense > revenue * 0.5 ? "high_expense_ratio"
    : "none";

  const recommendedAction =
    majorFinanceIssue === "cash_difference"
      ? "Audit kas fisik vs sistem; rekonsiliasi dengan kasir."
      : majorFinanceIssue === "settlement_mismatch"
        ? "Rekonsiliasi tender POS vs net sales; cek payment method breakdown."
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
    settlementDifference,
    netProfitEstimate: estimated_operating_result,
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
        settlementDifference: sql`excluded.settlement_difference`,
        netProfitEstimate: sql`excluded.net_profit_estimate`,
        majorFinanceIssue: sql`excluded.major_finance_issue`,
        recommendedAction: sql`excluded.recommended_action`,
        createdAt: new Date(),
      },
    });

  return upsertRow as unknown as FinDailySummary;
}