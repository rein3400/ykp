/**
 * Regenerate fin_daily_summary per (date, outlet) from POS/expense/supplier/
 * petty/closing tabs, then run the finance alert rules (brief §11) with
 * thresholds from finance_threshold_config (Revisi #10).
 *
 * - Upsert by deterministic summary_id (idempotent, safe to re-run).
 * - Alerts upserted with deterministic IDs (ALR-<date>-<RULE>-<outlet>).
 * - HIGH/CRITICAL alerts auto-create finance_action_tracker rows
 *   (ACT-<date>-<RULE>-<outlet>, PIC finance_admin, deadline +1 hari, OPEN).
 *
 * RBAC: finance_admin+ ('generate' on 'summary').
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, updateRow, findRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, handler, forbidden } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, todayWib } from '@/lib/format';
import { addDays, overdueDays } from '@/lib/wib';
import { can, type Role } from '@/lib/rbac';
import {
  computeDailySummary, sumExpenses, sumSupplierCost, isInactiveStatus, num,
  type FinanceRows
} from '@/lib/fin-summary';
import {
  evaluateFinanceAlerts, shouldCreateAction, thresholdValue,
  type FinanceRuleMetrics, type ThresholdRow
} from '@/lib/alert-rules';
import { finSummaryId, finAlertId, finActionId } from '@/lib/id-gen';
import { pushAlertNotification } from '@/lib/telegram';

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'generate', 'summary')) return forbidden('Regenerate membutuhkan role finance_admin atau lebih tinggi');

  const body = (await req.json().catch(() => ({}))) as { date?: string; outlet_id?: string };
  const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayWib();

  const [pos, expenses, suppliers, petty, closing, outlets, brands, thresholdRows, existingAlerts, existingActions] = await Promise.all([
    readTab<Record<string, string>>(TABS.posDaily),
    readTab<Record<string, string>>(TABS.expense),
    readTab<Record<string, string>>(TABS.supplierCost),
    readTab<Record<string, string>>(TABS.pettyCash),
    readTab<Record<string, string>>(TABS.closingCash),
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.thresholdConfig),
    readTab<Record<string, string>>(TABS.alertLog),
    readTab<Record<string, string>>(TABS.actionTracker)
  ]);

  const rows: FinanceRows = { pos, expenses, suppliers, petty, closing };
  const thresholds = thresholdRows as unknown as ThresholdRow[];
  const brandName = (id: string) => brands.find((b) => b.brand_id === id)?.brand_name ?? id;

  const targetOutlets = outlets.filter((o) =>
    o.status === 'active' && (!body.outlet_id || o.outlet_id === body.outlet_id)
  );
  if (targetOutlets.length === 0) return badRequest('Tidak ada outlet aktif untuk scope ini');

  const t = nowTimestampWib();
  const summaries: Record<string, string>[] = [];
  const newAlerts: Record<string, string>[] = [];
  const newActions: Record<string, string>[] = [];

  for (const outlet of targetOutlets) {
    const c = computeDailySummary(rows, date, outlet.outlet_id);
    const summaryId = finSummaryId(date, outlet.outlet_id);
    const row: Record<string, string> = {
      summary_id: summaryId,
      date,
      brand_id: outlet.brand_id,
      brand_name: brandName(outlet.brand_id),
      outlet_id: outlet.outlet_id,
      outlet_name: outlet.outlet_name,
      gross_sales: String(c.grossSales),
      net_sales: String(c.netSales),
      discount: String(c.discount),
      refund: String(c.refund),
      void: String(c.voidAmount),
      transaction_count: String(c.transactionCount),
      aov: String(c.aov),
      supplier_cost: String(c.supplierCost),
      petty_cash_out: String(c.pettyCashOut),
      total_expense: String(c.totalExpense),
      unpaid_supplier: String(c.unpaidSupplier),
      cash_difference: String(c.cashDifference),
      estimated_surplus: String(c.estimatedSurplus),
      top_supplier: c.topSupplier,
      top_expense_category: c.topExpenseCategory,
      major_finance_issue: c.majorFinanceIssue,
      recommended_action: c.recommendedAction,
      created_at: t
    };
    // Upsert by deterministic summary_id
    const existing = await findRow(TABS.dailySummary, 'summary_id', summaryId);
    if (existing) await updateRow(TABS.dailySummary, existing.rowNumber, row);
    else await appendRows(TABS.dailySummary, [row]);
    summaries.push(row);

    // ── Alert rule metrics ──────────────────────────────────────
    const ctx = { brandId: outlet.brand_id, outletId: outlet.outlet_id };
    let expense7dTotal = 0;
    for (let i = 1; i <= 7; i++) expense7dTotal += sumExpenses(expenses, addDays(date, -i), outlet.outlet_id);
    let supThisWeek = 0, supPrevWeek = 0;
    for (let i = 0; i < 7; i++) {
      supThisWeek += sumSupplierCost(suppliers, addDays(date, -i), outlet.outlet_id);
      supPrevWeek += sumSupplierCost(suppliers, addDays(date, -7 - i), outlet.outlet_id);
    }
    const oldestUnpaidDays = suppliers
      .filter((r) => r.outlet_id === outlet.outlet_id && num(r.unpaid_amount) > 0
        && ['UNPAID', 'PARTIAL', 'OVERDUE'].includes((r.payment_status ?? '').toUpperCase())
        && r.due_date && r.due_date < date)
      .reduce((max, r) => Math.max(max, overdueDays(r.due_date, date)), 0);
    const receiptMin = thresholdValue(thresholds, 'missing_receipt_min_amount', ctx);
    const missingReceiptCount =
      expenses.filter((r) => r.date === date && r.outlet_id === outlet.outlet_id
        && !isInactiveStatus(r.approval_status) && !isInactiveStatus(r.status)
        && !r.receipt_url && num(r.amount) >= receiptMin).length
      + suppliers.filter((r) => r.date_order === date && r.outlet_id === outlet.outlet_id
        && !isInactiveStatus(r.payment_status) && !r.invoice_url && num(r.total_amount) >= receiptMin).length
      + petty.filter((r) => r.date === date && r.outlet_id === outlet.outlet_id
        && !isInactiveStatus(r.approval_status) && num(r.credit_out) >= receiptMin && !r.receipt_url).length;

    const metrics: FinanceRuleMetrics = {
      date,
      outletId: outlet.outlet_id,
      outletName: outlet.outlet_name,
      brandId: outlet.brand_id,
      brandName: brandName(outlet.brand_id),
      cashDifference: c.cashDifference,
      settlementDifference: c.settlementDifference,
      unpaidSupplier: c.unpaidSupplier,
      oldestUnpaidDays,
      pettyCashOut: c.pettyCashOut,
      totalExpense: c.totalExpense,
      expenseAvg7d: expense7dTotal / 7,
      supplierCostThisWeek: supThisWeek,
      supplierCostPrevWeek: supPrevWeek,
      estimatedSurplus: c.estimatedSurplus,
      grossSales: c.grossSales,
      refund: c.refund,
      voidAmount: c.voidAmount,
      missingReceiptCount
    };

    for (const a of evaluateFinanceAlerts(metrics, thresholds)) {
      const alertId = finAlertId(date, a.alertType, outlet.outlet_id);
      if (existingAlerts.some((x) => x.alert_id === alertId)
        || newAlerts.some((x) => x.alert_id === alertId)) continue;
      const alertRow: Record<string, string> = {
        alert_id: alertId,
        date,
        brand_id: outlet.brand_id,
        brand: brandName(outlet.brand_id),
        outlet_id: outlet.outlet_id,
        outlet: outlet.outlet_name,
        source_app: 'finance',
        alert_type: a.alertType,
        severity: a.severity,
        title: a.title,
        message: a.message,
        status: 'OPEN',
        assigned_to: '',
        action_taken: '',
        reference_type: a.referenceType ?? '',
        reference_id: a.referenceId ?? '',
        created_at: t,
        resolved_at: ''
      };
      newAlerts.push(alertRow);

      if (shouldCreateAction(a.severity)) {
        const actionId = finActionId(date, a.alertType, outlet.outlet_id);
        if (existingActions.some((x) => x.action_id === actionId)
          || newActions.some((x) => x.action_id === actionId)) continue;
        newActions.push({
          action_id: actionId,
          source_alert_id: alertId,
          title: a.title,
          description: a.message,
          brand_id: outlet.brand_id,
          brand: brandName(outlet.brand_id),
          outlet_id: outlet.outlet_id,
          outlet: outlet.outlet_name,
          priority: a.severity,
          assigned_to: 'finance_admin',
          assigned_role: 'finance_admin',
          due_date: addDays(date, 1),
          status: 'OPEN',
          action_taken: '',
          created_at: t,
          updated_at: t,
          completed_at: ''
        });
      }
    }
  }

  if (newAlerts.length > 0) await appendRows(TABS.alertLog, newAlerts);
  if (newActions.length > 0) await appendRows(TABS.actionTracker, newActions);

  // Immediate Telegram push for newly created HIGH/CRITICAL alerts only
  // (deterministic IDs above guarantee re-runs never re-push; MEDIUM/LOW skipped).
  for (const a of newAlerts) {
    await pushAlertNotification('finance', {
      alertId: a.alert_id,
      alertType: a.alert_type,
      severity: a.severity,
      title: a.title,
      message: a.message,
      outletName: a.outlet,
      date: a.date
    });
  }

  await logAudit({
    module: 'finance', action: 'generate', recordType: 'fin_daily_summary',
    recordId: `regen-${date}`,
    afterValue: JSON.stringify({ date, outlets: targetOutlets.length, alerts: newAlerts.length, actions: newActions.length }),
    userId: s.userId
  }).catch(() => null);

  return ok({
    date,
    outlets: targetOutlets.length,
    summaries_upserted: summaries.length,
    alerts_created: newAlerts.length,
    actions_created: newActions.length,
    summaries,
    alerts: newAlerts
  }, 201);
});
