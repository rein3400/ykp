/**
 * fin_daily_summary engine (ported from ykp-erp engine fin-summary.ts; Drizzle
 * layer replaced with pure functions over sheet rows).
 *
 * ⚠ Revisi #3: the result of `net_sales - expense - supplier_cost - petty_cash_out`
 * is NEVER "Net Profit". It is `estimated_surplus` — "Estimated Cash Surplus"
 * (Estimasi Surplus Kas). Real Net Profit requires actual COGS
 * (opening inventory + purchase - closing inventory), which V1 does not have.
 *
 * Revisi #4 anti double-counting: rows already represented by a linked
 * counterpart are excluded from their own bucket:
 *   - fin_supplier_cost.linked_expense_id set → excluded from supplier_cost
 *     (the expense row is the primary record)
 *   - fin_petty_cash.linked_expense_id / linked_supplier_invoice_id set →
 *     excluded from petty_cash_out (expense / supplier invoice is primary)
 * CANCELLED / REJECTED rows are excluded everywhere (ported bug fix).
 *
 * Pure — no I/O, no Node deps. Used by the regenerate route AND client pages.
 */

export interface FinanceRows {
  pos: Record<string, string>[];
  expenses: Record<string, string>[];
  suppliers: Record<string, string>[];
  petty: Record<string, string>[];
  closing: Record<string, string>[];
}

export interface DailySummaryComputed {
  grossSales: number;
  netSales: number;
  discount: number;
  refund: number;
  voidAmount: number;
  transactionCount: number;
  aov: number;
  supplierCost: number;
  pettyCashOut: number;
  totalExpense: number;
  unpaidSupplier: number;
  cashDifference: number;
  settlementDifference: number;
  estimatedSurplus: number;
  topSupplier: string;
  topExpenseCategory: string;
  majorFinanceIssue: string;
  recommendedAction: string;
}

export function num(v: string | number | undefined | null): number {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** CANCELLED / REJECTED rows never count (ported fix). */
export function isInactiveStatus(status: string | undefined): boolean {
  const s = (status ?? '').toUpperCase();
  return s === 'CANCELLED' || s === 'REJECTED';
}

function inScope(row: Record<string, string>, date: string, outletId: string, dateField: string): boolean {
  return row[dateField] === date && row.outlet_id === outletId;
}

/** POS aggregates for (date, outlet). */
export function sumPos(rows: Record<string, string>[], date?: string, outletId?: string) {
  let gross = 0, net = 0, discount = 0, refund = 0, voidAmt = 0, tx = 0, settleDiff = 0, totalSettlement = 0;
  for (const r of rows) {
    if (date && r.date !== date) continue;
    if (outletId && r.outlet_id !== outletId) continue;
    gross += num(r.gross_sales);
    net += num(r.net_sales);
    discount += num(r.discount);
    refund += num(r.refund);
    voidAmt += num(r.void);
    tx += num(r.transaction_count);
    settleDiff += num(r.settlement_difference);
    totalSettlement += num(r.total_settlement);
  }
  return { gross, net, discount, refund, voidAmount: voidAmt, transactionCount: tx, settlementDifference: settleDiff, totalSettlement };
}

/** Expense total. Excludes CANCELLED/REJECTED. Expense rows are primary — links never exclude them. */
export function sumExpenses(rows: Record<string, string>[], date?: string, outletId?: string): number {
  let total = 0;
  for (const r of rows) {
    if (date && r.date !== date) continue;
    if (outletId && r.outlet_id !== outletId) continue;
    if (isInactiveStatus(r.approval_status) || isInactiveStatus(r.status)) continue;
    total += num(r.amount);
  }
  return total;
}

/** Supplier cost total. Excludes CANCELLED and rows linked to an expense (Revisi #4). */
export function sumSupplierCost(rows: Record<string, string>[], date?: string, outletId?: string): number {
  let total = 0;
  for (const r of rows) {
    if (date && r.date_order !== date) continue;
    if (outletId && r.outlet_id !== outletId) continue;
    if (isInactiveStatus(r.payment_status)) continue;
    if (r.linked_expense_id) continue; // already counted as expense
    total += num(r.total_amount);
  }
  return total;
}

/** Outstanding supplier payable (all rows up to and including `date`). */
export function sumUnpaidSupplier(rows: Record<string, string>[], date?: string, outletId?: string): number {
  let total = 0;
  for (const r of rows) {
    if (date && r.date_order > date) continue;
    if (outletId && r.outlet_id !== outletId) continue;
    const s = (r.payment_status ?? '').toUpperCase();
    if (s !== 'UNPAID' && s !== 'PARTIAL' && s !== 'OVERDUE') continue;
    const unpaid = num(r.unpaid_amount);
    if (unpaid > 0) total += unpaid;
  }
  return total;
}

/** Petty cash out. Excludes CANCELLED/REJECTED and rows linked to expense/supplier (Revisi #4). */
export function sumPettyCashOut(rows: Record<string, string>[], date?: string, outletId?: string): number {
  let total = 0;
  for (const r of rows) {
    if (date && r.date !== date) continue;
    if (outletId && r.outlet_id !== outletId) continue;
    if (isInactiveStatus(r.approval_status)) continue;
    if (r.linked_expense_id || r.linked_supplier_invoice_id) continue; // primary lives elsewhere
    total += num(r.credit_out);
  }
  return total;
}

/** Latest closing-cash difference for (date, outlet). 0 when no closing recorded. */
export function latestCashDifference(rows: Record<string, string>[], date: string, outletId: string): number {
  const mine = rows
    .filter((r) => inScope(r, date, outletId, 'date'))
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
  if (mine.length === 0) return 0;
  return num(mine[mine.length - 1].cash_difference);
}

/** Top supplier by total_amount for the date (excluding CANCELLED + linked). */
export function topSupplierForDate(rows: Record<string, string>[], date: string, outletId: string): string {
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (!inScope(r, date, outletId, 'date_order')) continue;
    if (isInactiveStatus(r.payment_status)) continue;
    if (r.linked_expense_id) continue;
    const name = r.supplier_name || r.supplier_id;
    totals.set(name, (totals.get(name) ?? 0) + num(r.total_amount));
  }
  return argMax(totals);
}

/** Top expense category for the date (excluding CANCELLED/REJECTED). */
export function topExpenseCategoryForDate(rows: Record<string, string>[], date: string, outletId: string): string {
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (!inScope(r, date, outletId, 'date')) continue;
    if (isInactiveStatus(r.approval_status) || isInactiveStatus(r.status)) continue;
    const name = r.expense_category || 'Other';
    totals.set(name, (totals.get(name) ?? 0) + num(r.amount));
  }
  return argMax(totals);
}

function argMax(totals: Map<string, number>): string {
  let best = '';
  let bestV = -Infinity;
  for (const [k, v] of totals) {
    if (v > bestV) { bestV = v; best = k; }
  }
  return bestV > 0 ? best : '';
}

/**
 * Compute one fin_daily_summary row for (date, outlet).
 * Satisfies blueprint §9.2 contract fields (gross_sales … estimated_surplus).
 */
export function computeDailySummary(rows: FinanceRows, date: string, outletId: string): DailySummaryComputed {
  const pos = sumPos(rows.pos, date, outletId);
  const totalExpense = sumExpenses(rows.expenses, date, outletId);
  const supplierCost = sumSupplierCost(rows.suppliers, date, outletId);
  const pettyCashOut = sumPettyCashOut(rows.petty, date, outletId);
  const unpaidSupplier = sumUnpaidSupplier(rows.suppliers, date, outletId);
  const cashDifference = latestCashDifference(rows.closing, date, outletId);
  const aov = pos.transactionCount > 0 ? Math.round(pos.net / pos.transactionCount) : 0;
  const estimatedSurplus = pos.net - totalExpense - supplierCost - pettyCashOut;

  // Priority: cash_difference > settlement_mismatch > unpaid_supplier > high_expense_ratio
  const majorFinanceIssue =
    cashDifference !== 0 ? 'cash_difference'
      : pos.settlementDifference !== 0 ? 'settlement_mismatch'
        : unpaidSupplier > 0 ? 'unpaid_supplier'
          : pos.net > 0 && totalExpense > pos.net * 0.5 ? 'high_expense_ratio'
            : 'none';

  const recommendedAction =
    majorFinanceIssue === 'cash_difference'
      ? 'Audit kas fisik vs sistem; rekonsiliasi dengan kasir.'
      : majorFinanceIssue === 'settlement_mismatch'
        ? 'Rekonsiliasi tender POS vs net sales; cek breakdown metode pembayaran.'
        : majorFinanceIssue === 'unpaid_supplier'
          ? 'Cek tagihan jatuh tempo dan jadwalkan pembayaran.'
          : majorFinanceIssue === 'high_expense_ratio'
            ? 'Tinjau kategori expense terbesar; cek margin outlet.'
            : '';

  return {
    grossSales: pos.gross,
    netSales: pos.net,
    discount: pos.discount,
    refund: pos.refund,
    voidAmount: pos.voidAmount,
    transactionCount: pos.transactionCount,
    aov,
    supplierCost,
    pettyCashOut,
    totalExpense,
    unpaidSupplier,
    cashDifference,
    settlementDifference: pos.settlementDifference,
    estimatedSurplus,
    topSupplier: topSupplierForDate(rows.suppliers, date, outletId),
    topExpenseCategory: topExpenseCategoryForDate(rows.expenses, date, outletId),
    majorFinanceIssue,
    recommendedAction
  };
}

// ── Ringkasan / period aggregation ──────────────────────────────

export interface PeriodFilter {
  from: string; // YYYY-MM-DD inclusive
  to: string;   // YYYY-MM-DD inclusive
  brandId?: string;
  outletId?: string;
}

function inPeriod(dateStr: string, f: PeriodFilter): boolean {
  return dateStr >= f.from && dateStr <= f.to;
}

function scopeRow(r: Record<string, string>, f: PeriodFilter): boolean {
  if (f.brandId && r.brand_id !== f.brandId) return false;
  if (f.outletId && r.outlet_id !== f.outletId) return false;
  return true;
}

export interface RingkasanKpis {
  grossSales: number;
  netSales: number;
  discount: number;
  refund: number;
  voidAmount: number;
  transactionCount: number;
  aov: number;
  totalExpense: number;
  supplierCost: number;
  supplierPaid: number;
  pettyCashOut: number;
  unpaidSupplier: number;
  cashDifference: number;
  settlementDifference: number;
  estimatedSurplus: number;
  cashIn: number;
  cashOut: number;
  topSupplier: string;
  topExpenseCategory: string;
}

/**
 * Consolidated KPIs for the Ringkasan page over an arbitrary period.
 * Same anti-double-count + cancellation rules as computeDailySummary.
 */
export function computeRingkasan(rows: FinanceRows, f: PeriodFilter): RingkasanKpis {
  let gross = 0, net = 0, discount = 0, refund = 0, voidAmt = 0, tx = 0;
  let settleDiff = 0, cashIn = 0;
  for (const r of rows.pos) {
    if (!inPeriod(r.date ?? '', f) || !scopeRow(r, f)) continue;
    gross += num(r.gross_sales);
    net += num(r.net_sales);
    discount += num(r.discount);
    refund += num(r.refund);
    voidAmt += num(r.void);
    tx += num(r.transaction_count);
    settleDiff += num(r.settlement_difference);
    const settlement = num(r.total_settlement);
    cashIn += settlement > 0 ? settlement : num(r.net_sales);
  }

  let totalExpense = 0;
  const expByCat = new Map<string, number>();
  for (const r of rows.expenses) {
    if (!inPeriod(r.date ?? '', f) || !scopeRow(r, f)) continue;
    if (isInactiveStatus(r.approval_status) || isInactiveStatus(r.status)) continue;
    const amt = num(r.amount);
    totalExpense += amt;
    const cat = r.expense_category || 'Other';
    expByCat.set(cat, (expByCat.get(cat) ?? 0) + amt);
  }

  let supplierCost = 0, supplierPaid = 0;
  const supByName = new Map<string, number>();
  for (const r of rows.suppliers) {
    if (!scopeRow(r, f)) continue;
    if (isInactiveStatus(r.payment_status)) continue;
    if (inPeriod(r.date_order ?? '', f) && !r.linked_expense_id) {
      const amt = num(r.total_amount);
      supplierCost += amt;
      supByName.set(r.supplier_name || r.supplier_id, (supByName.get(r.supplier_name || r.supplier_id) ?? 0) + amt);
    }
    if (inPeriod(r.date_order ?? '', f)) supplierPaid += num(r.paid_amount);
  }

  let pettyCashOut = 0;
  for (const r of rows.petty) {
    if (!inPeriod(r.date ?? '', f) || !scopeRow(r, f)) continue;
    if (isInactiveStatus(r.approval_status)) continue;
    if (r.linked_expense_id || r.linked_supplier_invoice_id) continue;
    pettyCashOut += num(r.credit_out);
  }

  // Outstanding payable is point-in-time (as of `to`), not a period sum.
  const unpaidSupplier = sumUnpaidSupplier(
    rows.suppliers.filter((r) => scopeRow(r, f)),
    f.to
  );

  // Latest cash difference per outlet in scope (latest closing within period).
  let cashDifference = 0;
  const outlets = new Set(rows.closing.filter((r) => scopeRow(r, f)).map((r) => r.outlet_id));
  for (const ol of outlets) {
    const mine = rows.closing
      .filter((r) => r.outlet_id === ol && inPeriod(r.date ?? '', f))
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.created_at ?? '').localeCompare(b.created_at ?? ''));
    if (mine.length > 0) cashDifference += num(mine[mine.length - 1].cash_difference);
  }

  const estimatedSurplus = net - totalExpense - supplierCost - pettyCashOut;
  const cashOut = supplierPaid + totalExpense + pettyCashOut;

  return {
    grossSales: gross,
    netSales: net,
    discount,
    refund,
    voidAmount: voidAmt,
    transactionCount: tx,
    aov: tx > 0 ? Math.round(net / tx) : 0,
    totalExpense,
    supplierCost,
    supplierPaid,
    pettyCashOut,
    unpaidSupplier,
    cashDifference,
    settlementDifference: settleDiff,
    estimatedSurplus,
    cashIn,
    cashOut,
    topSupplier: argMax(supByName),
    topExpenseCategory: argMax(expByCat)
  };
}

/** Latest running balance per petty-cash account (all-time). */
export function latestPettyBalances(rows: Record<string, string>[]): Map<string, number> {
  const sorted = [...rows].sort(
    (a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.created_at ?? '').localeCompare(b.created_at ?? '')
  );
  const out = new Map<string, number>();
  for (const r of sorted) {
    if (!r.account_id) continue;
    out.set(r.account_id, num(r.running_balance));
  }
  return out;
}

/**
 * Group Cash Position (approximation V1): latest physical cash per outlet
 * (from closing) + latest running balance per petty-cash account.
 */
export function computeGroupCashPosition(
  pettyRows: Record<string, string>[],
  closingRows: Record<string, string>[],
  f?: { brandId?: string; outletId?: string }
): number {
  let total = 0;
  const scoped = (r: Record<string, string>) =>
    (!f?.brandId || r.brand_id === f.brandId) && (!f?.outletId || r.outlet_id === f.outletId);

  for (const v of latestPettyBalances(pettyRows.filter(scoped)).values()) total += v;

  const latestClosing = new Map<string, Record<string, string>>();
  for (const r of [...closingRows].filter(scoped).sort(
    (a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.created_at ?? '').localeCompare(b.created_at ?? '')
  )) {
    latestClosing.set(r.outlet_id, r);
  }
  for (const r of latestClosing.values()) total += num(r.physical_cash);
  return total;
}

/** Net sales MoM growth % (current month vs previous month). Null when prev month has no sales. */
export function momNetSalesGrowth(posRows: Record<string, string>[], currentMonth: string, previousMonth: string): number | null {
  let cur = 0, prev = 0;
  for (const r of posRows) {
    const m = (r.date ?? '').slice(0, 7);
    if (m === currentMonth) cur += num(r.net_sales);
    else if (m === previousMonth) prev += num(r.net_sales);
  }
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

/** Unpaid supplier aging buckets (days past due_date as of `today`). */
export function unpaidAging(
  supplierRows: Record<string, string>[],
  today: string,
  f?: { brandId?: string; outletId?: string }
): { current: number; d1_7: number; d8_14: number; d15_30: number; over30: number } {
  const buckets = { current: 0, d1_7: 0, d8_14: 0, d15_30: 0, over30: 0 };
  for (const r of supplierRows) {
    if (f?.brandId && r.brand_id !== f.brandId) continue;
    if (f?.outletId && r.outlet_id !== f.outletId) continue;
    const s = (r.payment_status ?? '').toUpperCase();
    if (s !== 'UNPAID' && s !== 'PARTIAL' && s !== 'OVERDUE') continue;
    const unpaid = num(r.unpaid_amount);
    if (unpaid <= 0) continue;
    const due = r.due_date ?? '';
    const age = due && due < today
      ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86_400_000)
      : 0;
    if (age <= 0) buckets.current += unpaid;
    else if (age <= 7) buckets.d1_7 += unpaid;
    else if (age <= 14) buckets.d8_14 += unpaid;
    else if (age <= 30) buckets.d15_30 += unpaid;
    else buckets.over30 += unpaid;
  }
  return buckets;
}

/** Daily series for trend charts (net sales, expense, supplier cost, petty out, refund+void, aov). */
export function dailySeries(
  rows: FinanceRows,
  days: string[],
  f?: { brandId?: string; outletId?: string }
): { date: string; netSales: number; expense: number; supplierCost: number; pettyCashOut: number; refundVoid: number; aov: number }[] {
  const scoped: FinanceRows = {
    pos: rows.pos.filter((r) => (!f?.brandId || r.brand_id === f.brandId) && (!f?.outletId || r.outlet_id === f.outletId)),
    expenses: rows.expenses.filter((r) => (!f?.brandId || r.brand_id === f.brandId) && (!f?.outletId || r.outlet_id === f.outletId)),
    suppliers: rows.suppliers.filter((r) => (!f?.brandId || r.brand_id === f.brandId) && (!f?.outletId || r.outlet_id === f.outletId)),
    petty: rows.petty.filter((r) => (!f?.brandId || r.brand_id === f.brandId) && (!f?.outletId || r.outlet_id === f.outletId)),
    closing: []
  };
  return days.map((date) => {
    const pos = sumPos(scoped.pos, date);
    const tx = pos.transactionCount;
    return {
      date,
      netSales: pos.net,
      expense: sumExpenses(scoped.expenses, date),
      supplierCost: sumSupplierCost(scoped.suppliers, date),
      pettyCashOut: sumPettyCashOut(scoped.petty, date),
      refundVoid: pos.refund + pos.voidAmount,
      aov: tx > 0 ? Math.round(pos.net / tx) : 0
    };
  });
}
