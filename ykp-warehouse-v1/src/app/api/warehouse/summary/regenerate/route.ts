/**
 * Generate warehouse_daily_summary for today.
 * Phase 6 will expand to full 20+ KPIs from rules engine.
 * Currently uses available data: items + waste + legacy closing.
 */
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, handler } from '@/lib/http';
import { todayWib, nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';

export const POST = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  const today = todayWib();

  const [items, closing, waste, alerts, actions] = await Promise.all([
    readTab<Record<string, string>>(TABS.items),
    readTab<Record<string, string>>(TABS.legacyClosing),
    readTab<Record<string, string>>(TABS.waste),
    readTab<Record<string, string>>(TABS.alertLog),
    readTab<Record<string, string>>(TABS.actionTracker)
  ]);

  const activeItems = items.filter((i) => i.active_status === 'active');
  const todayClosing = closing.filter((c) => c.date === today);
  const todayWaste = waste.filter((w) => w.date === today);
  const openAlerts = alerts.filter((a) => a.status === 'OPEN' || a.status === 'IN_PROGRESS');
  const openActions = actions.filter((a) => a.status === 'OPEN' || a.status === 'IN_PROGRESS' || a.status === 'OVERDUE');
  const overdueActions = actions.filter((a) => a.status === 'OVERDUE');

  const criticalLow = activeItems.filter((i) => {
    const min = Number(i.minimum_stock || 0);
    return min > 0 && (i.criticality === 'CRITICAL' || i.criticality === 'HIGH');
  });
  const wasteValue = todayWaste.reduce((sum, w) => sum + Number(w.estimated_total_value || w.estimated_loss || 0), 0);
  const inventoryValue = activeItems.reduce((sum, i) => {
    // Rough estimate from average price * minimum_stock as proxy until ledger has book stock
    return sum + Number(i.average_purchase_price || 0) * Number(i.minimum_stock || 0);
  }, 0);
  const diffItems = todayClosing.filter((c) => Number(c.diff_pct || 0) > 5);

  const majorIssue = criticalLow.length > 0
    ? `${criticalLow.length} item kritikal di bawah minimum stock`
    : diffItems.length > 0
      ? `${diffItems.length} item unexplained variance > 5%`
      : '';
  const recommended = criticalLow.length > 0
    ? 'Review purchase recommendation dan konfirmasi PO hari ini'
    : diffItems.length > 0
      ? 'Lakukan recount item dengan variance tinggi'
      : '';

  const summaryId = nextSequentialIdSync('WHS');
  const row: Record<string, string> = {
    summary_id: summaryId,
    date: today,
    brand_id: '',
    brand_name: '',
    outlet_id: '',
    outlet_name: '',
    location_id: '',
    total_inventory_value: String(inventoryValue),
    critical_low_stock_count: String(criticalLow.length),
    stockout_risk_count: '0',
    purchase_recommendation_count: '0',
    estimated_purchase_value: '0',
    pending_purchase_request_count: '0',
    pending_receiving_count: '0',
    receiving_discrepancy_count: '0',
    pending_transfer_count: '0',
    transfer_discrepancy_count: '0',
    waste_item_count: String(todayWaste.length),
    waste_value: String(wasteValue),
    variance_item_count: String(diffItems.length),
    unexplained_variance_value: String(
      diffItems.reduce((sum, c) => sum + Math.abs(Number(c.difference || 0)) * Number(
        activeItems.find((i) => i.item_id === c.item_id)?.average_purchase_price || 0
      ), 0)
    ),
    near_expiry_item_count: '0',
    expired_item_count: '0',
    open_action_count: String(openActions.length),
    overdue_action_count: String(overdueActions.length),
    major_warehouse_issue: majorIssue,
    recommended_action: recommended,
    generated_at: nowTimestampWib()
  };
  await appendRows(TABS.dailySummary, [row]);
  return ok(row, 201);
});
