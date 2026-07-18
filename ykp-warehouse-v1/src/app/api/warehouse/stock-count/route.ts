/**
 * Stock Opname / Stock Count API — header+detail per brief §17.
 * Compares book stock vs physical stock. Uses "unexplained stock variance"
 * terminology (brief §3.1). Creates alerts + actions on variance over tolerance.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, notFound, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, formatDateWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertItem, assertLocation } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';
import { bookStock } from '@/lib/stock-ledger';
import { evalStockVariance, shouldCreateAction } from '@/lib/rules-engine';
import { dispatchAlertTelegram } from '@/lib/telegram';

const COUNT_TYPES = ['DAILY_CRITICAL', 'WEEKLY', 'MONTHLY', 'SPOT_CHECK', 'RECOUNT'];

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'stock_count')) return unauthorized('Forbidden');

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id) {
    const header = await findRow(TABS.stockCount, 'count_id', id);
    if (!header) return notFound('Stock count not found');
    const items = await readTab<Record<string, string>>(TABS.stockCountItem);
    return ok({ header: header.row, items: items.filter((r) => r.count_id === id) });
  }
  const headers = await readTab<Record<string, string>>(TABS.stockCount);
  return list(headers);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'stock_count')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as {
    count_type?: string; brand_id?: string; outlet_id?: string; location_id?: string;
    items?: Array<{
      item_id: string; physical_stock: number; base_unit?: string;
      theoretical_stock?: number; notes?: string;
    }>;
  };

  if (!body.location_id) return badRequest('location_id is required');
  if (!body.items || body.items.length === 0) return badRequest('At least one item is required');
  if (body.count_type && !COUNT_TYPES.includes(body.count_type)) {
    return badRequest(`count_type must be one of: ${COUNT_TYPES.join(', ')}`);
  }

  try {
    await assertLocation(body.location_id);
    for (const it of body.items) await assertItem(it.item_id);
  } catch (e) {
    if (e instanceof MissingRefError) return badRequest(e.message);
    throw e;
  }

  const now = nowTimestampWib();
  const countId = nextSequentialIdSync('CNT');
  const today = formatDateWib(new Date());

  // Load items master for tolerance + price
  const masterItems = await readTab<Record<string, string>>(TABS.items);
  const itemMap = new Map(masterItems.map((i) => [i.item_id, i]));

  const header: Record<string, string> = {
    count_id: countId,
    count_number: countId,
    count_date: today,
    count_type: body.count_type ?? 'DAILY_CRITICAL',
    brand_id: body.brand_id ?? '',
    outlet_id: body.outlet_id ?? '',
    location_id: body.location_id,
    status: 'COMPLETED',
    counted_by: s.userId,
    verified_by: '',
    approved_by: '',
    created_at: now,
    completed_at: now
  };
  await appendRows(TABS.stockCount, [header]);

  const detailRows: Record<string, string>[] = [];
  for (const it of body.items) {
    const master = itemMap.get(it.item_id);
    const book = await bookStock(it.item_id, body.location_id);
    const physical = it.physical_stock;
    const theoretical = it.theoretical_stock ?? 0;
    const varianceQty = physical - book;
    const variancePct = book > 0 ? (Math.abs(varianceQty) / book) * 100 : (varianceQty !== 0 ? 100 : 0);
    const unitCost = Number(master?.average_purchase_price || master?.latest_purchase_price || 0);
    const varianceValue = Math.round(Math.abs(varianceQty) * unitCost);
    const tolPct = Number(master?.tolerance_variance_percentage || 5);
    const tolValue = Number(master?.tolerance_variance_value || 0);

    // Severity
    let severity = 'NORMAL';
    if (Math.abs(variancePct) > tolPct * 2 || (tolValue > 0 && varianceValue > tolValue * 2)) severity = 'CRITICAL';
    else if (Math.abs(variancePct) > tolPct * 1.5) severity = 'HIGH';
    else if (Math.abs(variancePct) > tolPct) severity = 'WARNING';

    const overTolerance = Math.abs(variancePct) > tolPct || (tolValue > 0 && varianceValue > tolValue);
    const investigationStatus = overTolerance ? 'OPEN' : 'NOT_REQUIRED';
    const recountRequired = severity === 'HIGH' || severity === 'CRITICAL' ? 'Y' : 'N';

    const itemId = nextSequentialIdSync('CNI');
    const detail: Record<string, string> = {
      count_item_id: itemId,
      count_id: countId,
      item_id: it.item_id,
      book_stock: String(book),
      theoretical_stock: String(theoretical),
      physical_stock: String(physical),
      base_unit: it.base_unit || master?.base_unit || '',
      variance_vs_book_qty: String(varianceQty),
      variance_vs_book_percentage: variancePct.toFixed(1),
      variance_vs_book_value: String(varianceValue),
      variance_vs_theoretical_qty: String(physical - theoretical),
      tolerance_percentage: String(tolPct),
      tolerance_value: String(tolValue),
      severity,
      recount_required: recountRequired,
      recount_result: '',
      root_cause: '',
      investigation_status: investigationStatus,
      assigned_to: '',
      due_date: overTolerance ? today : '',
      approval_status: overTolerance ? 'PENDING' : 'NOT_REQUIRED',
      notes: it.notes ?? ''
    };
    detailRows.push(detail);

    // Create alert on variance
    if (overTolerance) {
      const alert = evalStockVariance(
        varianceQty, variancePct, varianceValue, tolPct, tolValue,
        master?.item_name || it.item_id, countId, it.item_id
      );
      if (alert) {
        const alertId = nextSequentialIdSync('ALR');
        const alertRow: Record<string, string> = {
          alert_id: alertId, alert_datetime: now, alert_type: alert.alertType,
          severity: alert.severity, brand_id: body.brand_id ?? '',
          outlet_id: body.outlet_id ?? '', location_id: body.location_id,
          item_id: it.item_id, reference_type: 'stock_count', reference_id: countId,
          title: alert.title, message: alert.message, status: 'OPEN',
          assigned_to: '', due_date: today, action_required: alert.actionRequired,
          telegram_status: 'QUEUED', created_at: now, resolved_at: '', resolved_by: ''
        };
        const startRow = await appendRows(TABS.alertLog, [alertRow]).catch(() => -1);
        await dispatchAlertTelegram({
          alertId,
          severity: alert.severity,
          alertType: alert.alertType,
          title: alert.title,
          message: alert.message,
          actionRequired: alert.actionRequired,
          startRow,
          alertRow,
        }).catch(() => null);

        if (shouldCreateAction(alert.severity)) {
          const actionId = nextSequentialIdSync('ACT');
          await appendRows(TABS.actionTracker, [{
            action_id: actionId, source_alert_id: alertId,
            title: alert.title, description: alert.message,
            brand_id: body.brand_id ?? '', outlet_id: body.outlet_id ?? '',
            location_id: body.location_id, item_id: it.item_id,
            priority: alert.severity, assigned_to: '', assigned_role: 'supervisor',
            due_date: today, status: 'OPEN', action_taken: '',
            attachment_url: '', approved_by: '',
            created_at: now, updated_at: now, completed_at: ''
          }]).catch(() => null);
        }
      }
    }
  }
  await appendRows(TABS.stockCountItem, detailRows);

  await logAudit({
    module: 'warehouse', action: 'create', recordType: 'stock_count',
    recordId: countId, afterValue: JSON.stringify({ header, items: detailRows }),
    userId: s.userId
  }).catch(() => null);

  return ok({ header, items: detailRows }, 201);
});
