/**
 * Finance alert rules (brief §11 + Revisi #5/#10, blueprint §10.4).
 *
 * Pure evaluation — no I/O. The caller computes metrics from sheet rows and
 * resolves thresholds from finance_threshold_config; this module maps them to
 * alert candidates with type + severity. HIGH/CRITICAL alerts auto-create
 * finance_action_tracker rows (see shouldCreateAction).
 *
 * Rules:
 *   1. CASH_DIFFERENCE      |cash_difference| >= 50k → HIGH, >= 200k → CRITICAL
 *   2. SUPPLIER_OVERDUE     unpaid overdue >= 7 hari → MEDIUM, >= 14 hari → HIGH
 *   3. PETTY_CASH_OVER_LIMIT petty_cash_out > limit harian → MEDIUM
 *   4. EXPENSE_SPIKE        expense > rata-rata 7 hari +20% → MEDIUM
 *   5. SUPPLIER_COST_SPIKE  supplier cost mingguan +15% → MEDIUM (2× batas → HIGH)
 *   6. MISSING_RECEIPT      transaksi tanpa nota ≥ min amount → LOW (≥3 → MEDIUM)
 *   7. NEGATIVE_SURPLUS     estimated_surplus < 0 → HIGH
 *   8. HIGH_REFUND_VOID     (refund+void)/gross >= 5% → MEDIUM, >= 10% → HIGH
 *   9. SETTLEMENT_MISMATCH  |settlement_difference| > tolerance → MEDIUM
 */

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type FinanceAlertType =
  | 'CASH_DIFFERENCE' | 'SUPPLIER_OVERDUE' | 'PETTY_CASH_OVER_LIMIT'
  | 'EXPENSE_SPIKE' | 'SUPPLIER_COST_SPIKE' | 'MISSING_RECEIPT'
  | 'NEGATIVE_SURPLUS' | 'HIGH_REFUND_VOID' | 'SETTLEMENT_MISMATCH';

export interface FinanceAlertCandidate {
  alertType: FinanceAlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  actionRequired: string;
  referenceType?: string;
  referenceId?: string;
}

// ── Threshold config (Revisi #10) ───────────────────────────────

export interface ThresholdRow {
  threshold_id?: string;
  key: string;
  label?: string;
  explanation?: string;
  value: string;
  unit?: string;
  severity?: string;
  scope?: string; // GLOBAL | BRAND | OUTLET
  brand_id?: string;
  outlet_id?: string;
  active?: string;
}

/** V1 defaults (GLOBAL scope) — used when the tab has no row for a key. */
export const DEFAULT_THRESHOLDS: ThresholdRow[] = [
  { key: 'cash_difference_warning', value: '50000', unit: 'IDR', severity: 'HIGH', scope: 'GLOBAL' },
  { key: 'cash_difference_critical', value: '200000', unit: 'IDR', severity: 'CRITICAL', scope: 'GLOBAL' },
  { key: 'supplier_overdue_days_warning', value: '7', unit: 'hari', severity: 'MEDIUM', scope: 'GLOBAL' },
  { key: 'supplier_overdue_days_critical', value: '14', unit: 'hari', severity: 'HIGH', scope: 'GLOBAL' },
  { key: 'petty_cash_daily_limit', value: '500000', unit: 'IDR', severity: 'MEDIUM', scope: 'GLOBAL' },
  { key: 'expense_spike_pct', value: '20', unit: '%', severity: 'MEDIUM', scope: 'GLOBAL' },
  { key: 'supplier_cost_spike_pct', value: '15', unit: '%', severity: 'MEDIUM', scope: 'GLOBAL' },
  { key: 'refund_void_pct_warning', value: '5', unit: '%', severity: 'MEDIUM', scope: 'GLOBAL' },
  { key: 'refund_void_pct_high', value: '10', unit: '%', severity: 'HIGH', scope: 'GLOBAL' },
  { key: 'settlement_mismatch_tolerance', value: '10000', unit: 'IDR', severity: 'MEDIUM', scope: 'GLOBAL' },
  { key: 'missing_receipt_min_amount', value: '100000', unit: 'IDR', severity: 'LOW', scope: 'GLOBAL' }
];

/**
 * Resolve the effective threshold for a key in a (brand, outlet) context.
 * Precedence: active OUTLET-scoped row for this outlet > active BRAND-scoped
 * row for this brand > active GLOBAL row > built-in default.
 */
export function resolveThreshold(
  rows: ThresholdRow[],
  key: string,
  ctx: { brandId?: string; outletId?: string }
): ThresholdRow {
  const active = rows.filter((r) => r.key === key && (r.active ?? 'true') !== 'false');
  const outletRow = ctx.outletId
    ? active.find((r) => (r.scope ?? 'GLOBAL') === 'OUTLET' && r.outlet_id === ctx.outletId)
    : undefined;
  if (outletRow) return outletRow;
  const brandRow = ctx.brandId
    ? active.find((r) => (r.scope ?? 'GLOBAL') === 'BRAND' && r.brand_id === ctx.brandId)
    : undefined;
  if (brandRow) return brandRow;
  const globalRow = active.find((r) => (r.scope ?? 'GLOBAL') === 'GLOBAL');
  if (globalRow) return globalRow;
  const def = DEFAULT_THRESHOLDS.find((r) => r.key === key);
  if (!def) throw new Error(`unknown threshold key: ${key}`);
  return def;
}

export function thresholdValue(rows: ThresholdRow[], key: string, ctx: { brandId?: string; outletId?: string }): number {
  return Number(resolveThreshold(rows, key, ctx).value) || 0;
}

// ── Metrics context for one (date, outlet) ──────────────────────

export interface FinanceRuleMetrics {
  date: string;
  outletId: string;
  outletName: string;
  brandId: string;
  brandName: string;
  cashDifference: number;
  settlementDifference: number;
  unpaidSupplier: number;
  oldestUnpaidDays: number;
  pettyCashOut: number;
  totalExpense: number;
  expenseAvg7d: number;         // rata-rata expense 7 hari sebelumnya (0 = no baseline)
  supplierCostThisWeek: number; // 7 hari termasuk date
  supplierCostPrevWeek: number; // 7 hari sebelumnya
  estimatedSurplus: number;
  grossSales: number;
  refund: number;
  voidAmount: number;
  missingReceiptCount: number;
}

export function evaluateFinanceAlerts(
  m: FinanceRuleMetrics,
  thresholds: ThresholdRow[]
): FinanceAlertCandidate[] {
  const ctx = { brandId: m.brandId, outletId: m.outletId };
  const t = (key: string) => thresholdValue(thresholds, key, ctx);
  const out: FinanceAlertCandidate[] = [];
  const at = m.outletName || m.outletId;

  // 1. CASH_DIFFERENCE — brief: ≥ Rp50.000 = HIGH
  const absDiff = Math.abs(m.cashDifference);
  if (absDiff >= t('cash_difference_critical')) {
    out.push({
      alertType: 'CASH_DIFFERENCE', severity: 'CRITICAL',
      title: `Selisih kas kritis ${at}`,
      message: `Selisih kas ${m.cashDifference} di ${at} melebihi batas kritis ${t('cash_difference_critical')} — audit wajib.`,
      actionRequired: 'Audit closing kasir hari ini; rekonsiliasi fisik vs sistem.',
      referenceType: 'closing_cash', referenceId: `${m.date}|${m.outletId}`
    });
  } else if (absDiff >= t('cash_difference_warning')) {
    out.push({
      alertType: 'CASH_DIFFERENCE', severity: 'HIGH',
      title: `Selisih kas ${at}`,
      message: `Selisih kas ${m.cashDifference} di ${at} melebihi batas ${t('cash_difference_warning')}.`,
      actionRequired: 'Rekonsiliasi kas fisik vs sistem sebelum tutup hari.',
      referenceType: 'closing_cash', referenceId: `${m.date}|${m.outletId}`
    });
  }

  // 2. SUPPLIER_OVERDUE
  if (m.unpaidSupplier > 0 && m.oldestUnpaidDays >= t('supplier_overdue_days_critical')) {
    out.push({
      alertType: 'SUPPLIER_OVERDUE', severity: 'HIGH',
      title: `Supplier overdue kritis ${at}`,
      message: `Tagihan supplier ${m.unpaidSupplier} di ${at}, tertua ${m.oldestUnpaidDays} hari lewat jatuh tempo — risiko supply stop.`,
      actionRequired: 'Jadwalkan pembayaran hari ini; hubungi supplier.',
      referenceType: 'supplier_cost', referenceId: m.outletId
    });
  } else if (m.unpaidSupplier > 0 && m.oldestUnpaidDays >= t('supplier_overdue_days_warning')) {
    out.push({
      alertType: 'SUPPLIER_OVERDUE', severity: 'MEDIUM',
      title: `Supplier jatuh tempo ${at}`,
      message: `Tagihan supplier ${m.unpaidSupplier} di ${at}, tertua ${m.oldestUnpaidDays} hari lewat jatuh tempo.`,
      actionRequired: 'Cek invoice dan rencanakan pembayaran minggu ini.',
      referenceType: 'supplier_cost', referenceId: m.outletId
    });
  }

  // 3. PETTY_CASH_OVER_LIMIT
  const pettyLimit = t('petty_cash_daily_limit');
  if (pettyLimit > 0 && m.pettyCashOut > pettyLimit) {
    out.push({
      alertType: 'PETTY_CASH_OVER_LIMIT', severity: 'MEDIUM',
      title: `Kas kecil over limit ${at}`,
      message: `Pengeluaran kas kecil ${m.pettyCashOut} di ${at} melebihi limit harian ${pettyLimit}.`,
      actionRequired: 'Cek nota dan approval pengeluaran kas kecil hari ini.',
      referenceType: 'petty_cash', referenceId: `${m.date}|${m.outletId}`
    });
  }

  // 4. EXPENSE_SPIKE (> N% vs rata-rata 7 hari)
  const spikePct = t('expense_spike_pct');
  if (m.expenseAvg7d > 0 && m.totalExpense > m.expenseAvg7d * (1 + spikePct / 100)) {
    const pct = Math.round(((m.totalExpense - m.expenseAvg7d) / m.expenseAvg7d) * 100);
    out.push({
      alertType: 'EXPENSE_SPIKE', severity: 'MEDIUM',
      title: `Expense naik ${pct}% ${at}`,
      message: `Total expense ${m.totalExpense} di ${at} naik ${pct}% vs rata-rata 7 hari (${Math.round(m.expenseAvg7d)}).`,
      actionRequired: 'Tinjau kategori expense terbesar hari ini.',
      referenceType: 'expense', referenceId: `${m.date}|${m.outletId}`
    });
  }

  // 5. SUPPLIER_COST_SPIKE (mingguan)
  const supPct = t('supplier_cost_spike_pct');
  if (m.supplierCostPrevWeek > 0 && m.supplierCostThisWeek > m.supplierCostPrevWeek * (1 + supPct / 100)) {
    const pct = Math.round(((m.supplierCostThisWeek - m.supplierCostPrevWeek) / m.supplierCostPrevWeek) * 100);
    out.push({
      alertType: 'SUPPLIER_COST_SPIKE',
      severity: pct >= supPct * 2 ? 'HIGH' : 'MEDIUM',
      title: `Biaya supplier naik ${pct}% ${at}`,
      message: `Pembelian supplier minggu ini ${m.supplierCostThisWeek} di ${at} naik ${pct}% vs minggu lalu (${m.supplierCostPrevWeek}).`,
      actionRequired: 'Cek harga supplier dominan; bandingkan supplier alternatif.',
      referenceType: 'supplier_cost', referenceId: m.outletId
    });
  }

  // 6. MISSING_RECEIPT
  if (m.missingReceiptCount >= 3) {
    out.push({
      alertType: 'MISSING_RECEIPT', severity: 'MEDIUM',
      title: `${m.missingReceiptCount} transaksi tanpa nota ${at}`,
      message: `${m.missingReceiptCount} transaksi tanpa nota/bukti di ${at}.`,
      actionRequired: 'Minta PIC upload nota sebelum akhir hari.',
      referenceType: 'expense', referenceId: m.outletId
    });
  } else if (m.missingReceiptCount > 0) {
    out.push({
      alertType: 'MISSING_RECEIPT', severity: 'LOW',
      title: `Nota belum lengkap ${at}`,
      message: `${m.missingReceiptCount} transaksi tanpa nota/bukti di ${at}.`,
      actionRequired: 'Lengkapi bukti transaksi.',
      referenceType: 'expense', referenceId: m.outletId
    });
  }

  // 7. NEGATIVE_SURPLUS — brief: net profit minus = HIGH
  if (m.estimatedSurplus < 0) {
    out.push({
      alertType: 'NEGATIVE_SURPLUS', severity: 'HIGH',
      title: `Surplus kas negatif ${at}`,
      message: `Estimasi surplus kas ${m.estimatedSurplus} di ${at} — pengeluaran melebihi pendapatan hari ini.`,
      actionRequired: 'Evaluasi expense dan pembelian supplier hari ini.',
      referenceType: 'daily_summary', referenceId: `${m.date}|${m.outletId}`
    });
  }

  // 8. HIGH_REFUND_VOID
  if (m.grossSales > 0) {
    const pct = ((m.refund + m.voidAmount) / m.grossSales) * 100;
    if (pct >= t('refund_void_pct_high')) {
      out.push({
        alertType: 'HIGH_REFUND_VOID', severity: 'HIGH',
        title: `Refund/void kritis ${at}`,
        message: `Refund+void ${pct.toFixed(1)}% dari gross sales di ${at} (${m.refund + m.voidAmount}).`,
        actionRequired: 'Audit transaksi refund/void; verifikasi approval kasir.',
        referenceType: 'pos', referenceId: `${m.date}|${m.outletId}`
      });
    } else if (pct >= t('refund_void_pct_warning')) {
      out.push({
        alertType: 'HIGH_REFUND_VOID', severity: 'MEDIUM',
        title: `Refund/void tinggi ${at}`,
        message: `Refund+void ${pct.toFixed(1)}% dari gross sales di ${at} (${m.refund + m.voidAmount}).`,
        actionRequired: 'Cek transaksi refund/void hari ini.',
        referenceType: 'pos', referenceId: `${m.date}|${m.outletId}`
      });
    }
  }

  // 9. SETTLEMENT_MISMATCH (Revisi #5)
  const settleTol = t('settlement_mismatch_tolerance');
  if (Math.abs(m.settlementDifference) > settleTol) {
    out.push({
      alertType: 'SETTLEMENT_MISMATCH', severity: 'MEDIUM',
      title: `Settlement POS tidak cocok ${at}`,
      message: `Selisih settlement ${m.settlementDifference} di ${at}: total metode pembayaran tidak sama dengan net sales (toleransi ${settleTol}).`,
      actionRequired: 'Rekonsiliasi breakdown Cash/QRIS/Card/Transfer/Marketplace dengan net sales.',
      referenceType: 'pos', referenceId: `${m.date}|${m.outletId}`
    });
  }

  return out;
}

/** HIGH/CRITICAL alerts auto-create action tracker rows. */
export function shouldCreateAction(severity: AlertSeverity): boolean {
  return severity === 'HIGH' || severity === 'CRITICAL';
}
