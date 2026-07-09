/**
 * POST /api/fin/export/csv — real RFC 4180 CSV export.
 *
 * Pulls the rows for the requested report window from the finance DB,
 * formats them with RFC 4180 escaping (quoted fields when the value
 * contains a comma, double-quote, CR, or LF; embedded quotes doubled),
 * and returns the file inline as a data URL plus the raw text body so
 * the client can render a download button or stream directly.
 *
 * No external CSV library is required — the writer is a single pure
 * function that handles all the corner cases of the spec.
 */
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { Role } from "@ykp/config";
import { requireRole, can } from "@ykp/auth";
import {
  finPosDaily,
  finSupplierCost,
  finPettyCash,
  finExpense,
  finClosingCash,
  finDailySummary,
} from "@ykp/schema";
import { getFinanceDb } from "@finance/lib/server/db";
import { handler, ok, fail } from "@finance/lib/server/http";
import { FinExportRequestSchema } from "@finance/lib/schemas";
import { todayWib } from "@ykp/engine";

/** RFC 4180 §2.6: quote a field when it contains the separator, a quote,
 *  CR, or LF. Inside the quoted form, embedded quotes are doubled. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (value instanceof Date) {
    s = value.toISOString().slice(0, 10);
  } else if (typeof value === "object") {
    s = JSON.stringify(value);
  } else {
    s = String(value);
  }
  const needsQuote = /[",\r\n]/.test(s);
  if (!needsQuote) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines: string[] = [];
  lines.push(csvRow(headers));
  for (const row of rows) lines.push(csvRow(row));
  // RFC 4180 §2.1: lines end with CRLF.
  return lines.join("\r\n") + "\r\n";
}

function toDataUrl(content: string, mime: string): string {
  // Encode as base64 in a Buffer to avoid the "invalid character" range
  // problem with binary-ish payloads in URLs.
  const b64 = Buffer.from(content, "utf8").toString("base64");
  return `data:${mime};base64,${b64}`;
}

export const POST = handler(async (req: Request) => {
  const user = await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.BRAND_MANAGER]);
  if (!can(user.role, "report", "export")) return fail("forbidden", "Role cannot export CSV");

  const body = await req.json();
  const parsed = FinExportRequestSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid export request", parsed.error.flatten());

  const { report, date_from, date_to, filters } = parsed.data;
  const db = getFinanceDb();
  const filters_ = filters ?? {};

  let headers: string[] = [];
  let rows: unknown[][] = [];

  switch (report) {
    case "pos_daily": {
      const conds = [gte(finPosDaily.date, new Date(date_from)), lte(finPosDaily.date, new Date(date_to))];
      if (filters_.outlet_id) conds.push(eq(finPosDaily.outletId, filters_.outlet_id));
      if (filters_.brand_id) conds.push(eq(finPosDaily.brandId, filters_.brand_id));
      const result = await db.select().from(finPosDaily).where(and(...conds)).orderBy(asc(finPosDaily.date));
      headers = ["pos_id", "date", "brand_id", "outlet_id", "gross_sales", "net_sales", "discount", "refund", "void", "tax", "service_charge", "transaction_count", "aov", "payment_methods", "source", "recorded_by"];
      rows = result.map((r) => [
        r.posId, r.date, r.brandId, r.outletId, r.grossSales, r.netSales, r.discount, r.refund,
        r.void, r.tax, r.serviceCharge, r.transactionCount, r.aov,
        r.paymentMethodBreakdown ? JSON.stringify(r.paymentMethodBreakdown) : "",
        r.source, r.recordedBy ?? "",
      ]);
      break;
    }
    case "supplier_cost": {
      const conds = [gte(finSupplierCost.date, new Date(date_from)), lte(finSupplierCost.date, new Date(date_to))];
      if (filters_.outlet_id) conds.push(eq(finSupplierCost.outletId, filters_.outlet_id));
      if (filters_.brand_id) conds.push(eq(finSupplierCost.brandId, filters_.brand_id));
      if (filters_.supplier_id) conds.push(eq(finSupplierCost.supplierId, filters_.supplier_id));
      if (filters_.status) conds.push(eq(finSupplierCost.paymentStatus, filters_.status as never));
      const result = await db.select().from(finSupplierCost).where(and(...conds)).orderBy(asc(finSupplierCost.date));
      headers = ["cost_id", "date", "outlet_id", "supplier_id", "supplier_name", "amount", "paid_amount", "unpaid_amount", "payment_status", "due_date", "description", "recorded_by"];
      rows = result.map((r) => [
        r.costId, r.date, r.outletId, r.supplierId, r.supplierName, r.amount, r.paidAmount, r.unpaidAmount,
        r.paymentStatus, r.dueDate ?? "", r.description ?? "", r.recordedBy ?? "",
      ]);
      break;
    }
    case "petty_cash": {
      const conds = [gte(finPettyCash.date, new Date(date_from)), lte(finPettyCash.date, new Date(date_to))];
      if (filters_.outlet_id) conds.push(eq(finPettyCash.outletId, filters_.outlet_id));
      const result = await db.select().from(finPettyCash).where(and(...conds)).orderBy(asc(finPettyCash.date));
      headers = ["pc_id", "date", "outlet_id", "account_id", "type", "amount", "urgent_flag", "approval_status", "description", "recorded_by"];
      rows = result.map((r) => [
        r.pcId, r.date, r.outletId, r.accountId, r.type, r.amount, r.urgentFlag ? "true" : "false",
        r.approvalStatus, r.description ?? "", r.recordedBy ?? "",
      ]);
      break;
    }
    case "expense": {
      const conds = [gte(finExpense.date, new Date(date_from)), lte(finExpense.date, new Date(date_to))];
      if (filters_.outlet_id) conds.push(eq(finExpense.outletId, filters_.outlet_id));
      const result = await db.select().from(finExpense).where(and(...conds)).orderBy(asc(finExpense.date));
      headers = ["expense_id", "date", "outlet_id", "category_id", "amount", "payment_method_id", "approval_status", "approved_by", "description", "recorded_by"];
      rows = result.map((r) => [
        r.expenseId, r.date, r.outletId, r.categoryId, r.amount, r.paymentMethodId,
        r.approvalStatus, r.approvedBy ?? "", r.description ?? "", r.recordedBy ?? "",
      ]);
      break;
    }
    case "closing_cash": {
      const conds = [gte(finClosingCash.date, new Date(date_from)), lte(finClosingCash.date, new Date(date_to))];
      if (filters_.outlet_id) conds.push(eq(finClosingCash.outletId, filters_.outlet_id));
      const result = await db.select().from(finClosingCash).where(and(...conds)).orderBy(asc(finClosingCash.date));
      headers = ["closing_id", "date", "outlet_id", "physical_cash", "expected_cash", "cash_difference", "recorded_by"];
      rows = result.map((r) => [
        r.closingId, r.date, r.outletId, r.physicalCash, r.expectedCash, r.cashDifference, r.recordedBy ?? "",
      ]);
      break;
    }
    case "summary": {
      const conds = [gte(finDailySummary.date, new Date(date_from)), lte(finDailySummary.date, new Date(date_to))];
      if (filters_.outlet_id) conds.push(eq(finDailySummary.outlet, filters_.outlet_id));
      const result = await db.select().from(finDailySummary).where(and(...conds)).orderBy(asc(finDailySummary.date));
      headers = ["summary_id", "date", "outlet", "revenue", "expense", "supplier_cost", "petty_cash_out", "unpaid_supplier", "cash_difference", "net_profit_estimate", "major_finance_issue"];
      rows = result.map((r) => [
        r.summaryId, r.date, r.outlet, r.revenue, r.expense, r.supplierCost, r.pettyCashOut,
        r.unpaidSupplier, r.cashDifference, r.netProfitEstimate, r.majorFinanceIssue ?? "",
      ]);
      break;
    }
    case "profit": {
      // Same shape as summary; export the computed rows so the caller can
      // audit the per-day P&L that the analytics/profit route derives.
      const conds = [gte(finDailySummary.date, new Date(date_from)), lte(finDailySummary.date, new Date(date_to))];
      if (filters_.outlet_id) conds.push(eq(finDailySummary.outlet, filters_.outlet_id));
      const result = await db.select().from(finDailySummary).where(and(...conds)).orderBy(asc(finDailySummary.date));
      headers = ["summary_id", "date", "outlet", "revenue", "expense", "supplier_cost", "petty_cash_out", "net_profit_estimate"];
      rows = result.map((r) => [r.summaryId, r.date, r.outlet, r.revenue, r.expense, r.supplierCost, r.pettyCashOut, r.netProfitEstimate]);
      break;
    }
  }

  const csv = toCsv(headers, rows);
  const stamp = todayWib().replace(/-/g, "");
  const filename = `ykp-finance-${report}-${date_from}_${date_to}-${stamp}.csv`;
  const download_url = toDataUrl(csv, "text/csv;charset=utf-8");

  return ok({
    download_url,
    filename,
    mime_type: "text/csv;charset=utf-8",
    byte_size: Buffer.byteLength(csv, "utf8"),
    row_count: rows.length,
    report,
    date_from,
    date_to,
    generated_by: user.id,
    inline: csv,
  });
});