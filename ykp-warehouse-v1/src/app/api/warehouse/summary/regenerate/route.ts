/**
 * Regenerate warehouse_daily_summary for a date (default: today WIB).
 *
 * Idempotent: the row is keyed by deterministic summary_id `WHS-<date>` and
 * upserted via findRow/updateRow (append only on first run) — re-running for
 * the same date never duplicates the daily row. Same pattern as the
 * finance/ops regenerate routes.
 *
 * KPI sources (new flows first; legacy kept only as migration fallback):
 * - receiving / transfer / purchase engine / batch stock / stock-count tabs
 *   drive pending counts, discrepancies, expiry and variance KPIs.
 * - Variance falls back to legacy f5_closing (diff_pct > 5) ONLY when no
 *   warehouse_stock_count data exists for the date.
 * - total_inventory_value = book stock × unit cost from warehouse_batch_stock
 *   when batch cost data exists (value_basis=BATCH_STOCK); otherwise the old
 *   average_purchase_price × minimum_stock proxy is used
 *   (value_basis=PROXY_AVG_PRICE_X_MIN_STOCK). The basis is recorded in the
 *   additive `value_basis` column (see TAB_HEADERS note in src/db/sheets.ts).
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, updateRow, findRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { todayWib, nowTimestampWib } from '@/lib/format';

const num = (v: string | undefined | null) => Number(v || 0);

/** YYYY-MM-DD + n days (lexicographic-safe date math). */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as { date?: string };
  const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayWib();

  const [
    items, closing, waste, actions,
    receiving, transfer, transferItem,
    stockCount, stockCountItem, batchStock,
    purchaseRecommendation, purchaseRequest
  ] = await Promise.all([
    readTab<Record<string, string>>(TABS.items),
    readTab<Record<string, string>>(TABS.legacyClosing),
    readTab<Record<string, string>>(TABS.waste),
    readTab<Record<string, string>>(TABS.actionTracker),
    readTab<Record<string, string>>(TABS.receiving),
    readTab<Record<string, string>>(TABS.transfer),
    readTab<Record<string, string>>(TABS.transferItem),
    readTab<Record<string, string>>(TABS.stockCount),
    readTab<Record<string, string>>(TABS.stockCountItem),
    readTab<Record<string, string>>(TABS.batchStock),
    readTab<Record<string, string>>(TABS.purchaseRecommendation),
    readTab<Record<string, string>>(TABS.purchaseRequest)
  ]);

  const activeItems = items.filter((i) => i.active_status === 'active');
  const todayWaste = waste.filter((w) => w.date === date);
  const openActions = actions.filter((a) => a.status === 'OPEN' || a.status === 'IN_PROGRESS' || a.status === 'OVERDUE');
  const overdueActions = actions.filter((a) => a.status === 'OVERDUE');

  // ── Book stock from batch stock (FEFO layer) ──────────────────
  const liveBatches = batchStock.filter((b) => num(b.current_qty) > 0);
  const hasBatchData = liveBatches.length > 0;
  const bookQtyByItem = new Map<string, number>();
  for (const b of liveBatches) {
    bookQtyByItem.set(b.item_id, (bookQtyByItem.get(b.item_id) ?? 0) + num(b.current_qty));
  }

  // ── Inventory value: book stock × unit cost when cost data exists ──
  let inventoryValue: number;
  let valueBasis: string;
  if (hasBatchData) {
    inventoryValue = liveBatches.reduce((sum, b) => sum + num(b.current_qty) * num(b.unit_cost), 0);
    valueBasis = 'BATCH_STOCK';
  } else {
    // Proxy fallback until the ledger/batch layer carries cost data.
    inventoryValue = activeItems.reduce((sum, i) => sum + num(i.average_purchase_price) * num(i.minimum_stock), 0);
    valueBasis = 'PROXY_AVG_PRICE_X_MIN_STOCK';
  }

  // ── Stock risk KPIs ───────────────────────────────────────────
  const criticalItems = activeItems.filter(
    (i) => (i.criticality === 'CRITICAL' || i.criticality === 'HIGH') && num(i.minimum_stock) > 0
  );
  // With book stock: genuinely below minimum. Without: keep the legacy proxy
  // (all critical/high items with a minimum) so the KPI stays conservative.
  const criticalLow = hasBatchData
    ? criticalItems.filter((i) => (bookQtyByItem.get(i.item_id) ?? 0) < num(i.minimum_stock))
    : criticalItems;
  const stockoutRisk = hasBatchData
    ? activeItems.filter((i) => num(i.minimum_stock) > 0 && (bookQtyByItem.get(i.item_id) ?? 0) <= 0)
    : [];

  // ── Receiving / transfer flow KPIs ────────────────────────────
  const todayReceiving = receiving.filter((r) => r.date === date);
  const pendingReceiving = todayReceiving.filter((r) => !r.approved_at);
  const receivingDiscrepancy = todayReceiving.filter(
    (r) => (r.receiving_status ?? '').toUpperCase() === 'DISCREPANCY'
  );

  const todayTransfers = transfer.filter((t) => t.date === date);
  const terminalTransfer = new Set(['RECEIVED', 'CANCELLED']);
  const pendingTransfers = todayTransfers.filter(
    (t) => !terminalTransfer.has((t.status ?? '').toUpperCase())
  );
  const todayTransferIds = new Set(todayTransfers.map((t) => t.transfer_id));
  const itemLevelDiscrepancy = new Set(
    transferItem
      .filter((ti) => todayTransferIds.has(ti.transfer_id) && num(ti.discrepancy_qty) > 0)
      .map((ti) => ti.transfer_id)
  );
  const transferDiscrepancy = todayTransfers.filter(
    (t) => (t.status ?? '').toUpperCase() === 'DISCREPANCY' || itemLevelDiscrepancy.has(t.transfer_id)
  );

  // ── Purchase engine KPIs ──────────────────────────────────────
  const pendingRecs = purchaseRecommendation.filter(
    (r) => r.date === date && (r.recommendation_status ?? '').toUpperCase() === 'PENDING'
  );
  const estimatedPurchaseValue = pendingRecs.reduce((sum, r) => sum + num(r.estimated_purchase_value), 0);
  const pendingRequests = purchaseRequest.filter(
    (r) => r.date === date && ['DRAFT', 'SUBMITTED'].includes((r.status ?? '').toUpperCase())
  );

  // ── Variance: stock-count flow first, legacy closing fallback ──
  const todayCounts = stockCount.filter((c) => c.count_date === date);
  let varianceItemCount: number;
  let unexplainedVarianceValue: number;
  if (todayCounts.length > 0) {
    const countIds = new Set(todayCounts.map((c) => c.count_id));
    const overTolerance = stockCountItem.filter(
      (ci) => countIds.has(ci.count_id) && (ci.severity ?? 'NORMAL').toUpperCase() !== 'NORMAL'
    );
    varianceItemCount = overTolerance.length;
    unexplainedVarianceValue = overTolerance.reduce((sum, ci) => sum + Math.abs(num(ci.variance_vs_book_value)), 0);
  } else {
    // Legacy fallback: f5_closing rows with unexplained diff > 5%.
    const diffItems = closing.filter((c) => c.date === date && num(c.diff_pct) > 5);
    varianceItemCount = diffItems.length;
    unexplainedVarianceValue = diffItems.reduce(
      (sum, c) => sum + Math.abs(num(c.difference)) * num(
        activeItems.find((i) => i.item_id === c.item_id)?.average_purchase_price
      ),
      0
    );
  }

  // ── Expiry KPIs from batch stock ──────────────────────────────
  const nearExpiryLimit = addDays(date, 3);
  const nearExpiry = liveBatches.filter(
    (b) => b.expiry_date && b.expiry_date >= date && b.expiry_date <= nearExpiryLimit
  );
  const expired = liveBatches.filter((b) => b.expiry_date && b.expiry_date < date);

  const wasteValue = todayWaste.reduce(
    (sum, w) => sum + (num(w.estimated_total_value) || num(w.estimated_loss)), 0
  );

  const majorIssue = criticalLow.length > 0
    ? `${criticalLow.length} item kritikal di bawah minimum stock`
    : varianceItemCount > 0
      ? `${varianceItemCount} item unexplained variance di atas toleransi`
      : '';
  const recommended = criticalLow.length > 0
    ? 'Review purchase recommendation dan konfirmasi PO hari ini'
    : varianceItemCount > 0
      ? 'Lakukan recount item dengan variance tinggi'
      : '';

  const summaryId = `WHS-${date}`;
  const row: Record<string, string> = {
    summary_id: summaryId,
    date,
    brand_id: '',
    brand_name: '',
    outlet_id: '',
    outlet_name: '',
    location_id: '',
    total_inventory_value: String(Math.round(inventoryValue)),
    critical_low_stock_count: String(criticalLow.length),
    stockout_risk_count: String(stockoutRisk.length),
    purchase_recommendation_count: String(pendingRecs.length),
    estimated_purchase_value: String(Math.round(estimatedPurchaseValue)),
    pending_purchase_request_count: String(pendingRequests.length),
    pending_receiving_count: String(pendingReceiving.length),
    receiving_discrepancy_count: String(receivingDiscrepancy.length),
    pending_transfer_count: String(pendingTransfers.length),
    transfer_discrepancy_count: String(transferDiscrepancy.length),
    waste_item_count: String(todayWaste.length),
    waste_value: String(Math.round(wasteValue)),
    variance_item_count: String(varianceItemCount),
    unexplained_variance_value: String(Math.round(unexplainedVarianceValue)),
    near_expiry_item_count: String(nearExpiry.length),
    expired_item_count: String(expired.length),
    open_action_count: String(openActions.length),
    overdue_action_count: String(overdueActions.length),
    major_warehouse_issue: majorIssue,
    recommended_action: recommended,
    generated_at: nowTimestampWib(),
    value_basis: valueBasis
  };

  // Deterministic upsert by summary_id — safe to re-run (idempotent).
  const existing = await findRow(TABS.dailySummary, 'summary_id', summaryId);
  if (existing) await updateRow(TABS.dailySummary, existing.rowNumber, row);
  else await appendRows(TABS.dailySummary, [row]);

  await logAudit({
    module: 'warehouse', action: 'generate', recordType: 'warehouse_daily_summary',
    recordId: summaryId,
    afterValue: JSON.stringify({ date, upserted: existing ? 'updated' : 'inserted', value_basis: valueBasis }),
    userId: s.userId
  }).catch(() => null);

  return ok({ ...row, upserted: existing ? 'updated' : 'inserted' }, existing ? 200 : 201);
});
