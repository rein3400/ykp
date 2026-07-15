/**
 * Batch Stock / Expiry Monitoring API per brief §18.
 * Tracks batch-level stock with expiry dates. Supports FEFO.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, formatDateWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertItem, assertLocation } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';
import { evalNearExpiry, evalExpiredStock, shouldCreateAction } from '@/lib/rules-engine';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'batch_stock')) return unauthorized('Forbidden');

  const url = new URL(req.url);
  const itemId = url.searchParams.get('item_id');
  const locationId = url.searchParams.get('location_id');
  const status = url.searchParams.get('status');

  let rows = await readTab<Record<string, string>>(TABS.batchStock);
  if (itemId) rows = rows.filter((r) => r.item_id === itemId);
  if (locationId) rows = rows.filter((r) => r.location_id === locationId);
  if (status) rows = rows.filter((r) => r.status === status);

  // Sort by expiry date ASC (FEFO)
  rows.sort((a, b) => (a.expiry_date || '9999').localeCompare(b.expiry_date || '9999'));
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'batch_stock')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.item_id) return badRequest('item_id is required');
  if (!body.location_id) return badRequest('location_id is required');
  if (!body.batch_number) return badRequest('batch_number is required');
  if (!body.current_qty) return badRequest('current_qty is required');

  try {
    await assertItem(body.item_id);
    await assertLocation(body.location_id);
  } catch (e) {
    if (e instanceof MissingRefError) return badRequest(e.message);
    throw e;
  }

  const now = nowTimestampWib();
  const today = formatDateWib(new Date());
  const id = nextSequentialIdSync('BAT');

  // Determine status based on expiry
  let status = 'ACTIVE';
  if (body.expiry_date) {
    const daysUntil = daysBetween(today, body.expiry_date);
    if (daysUntil < 0) status = 'EXPIRED';
    else if (daysUntil <= 7) status = 'NEAR_EXPIRY';
  }
  if (Number(body.current_qty) <= 0) status = 'DEPLETED';

  const row: Record<string, string> = {
    batch_stock_id: id,
    item_id: body.item_id,
    location_id: body.location_id,
    batch_number: body.batch_number,
    expiry_date: body.expiry_date ?? '',
    received_date: body.received_date ?? today,
    current_qty: body.current_qty,
    unit: body.unit ?? '',
    unit_cost: body.unit_cost ?? '0',
    status,
    created_at: now,
    updated_at: now
  };
  await appendRows(TABS.batchStock, [row]);

  // Create alerts for near/expired
  if (body.expiry_date) {
    const daysUntil = daysBetween(today, body.expiry_date);
    const qty = Number(body.current_qty);
    let alert = evalExpiredStock(daysUntil, qty, body.item_id, body.batch_number, body.item_id);
    if (!alert) alert = evalNearExpiry(daysUntil, 7, qty, body.item_id, body.batch_number, body.item_id);
    if (alert) {
      const alertId = nextSequentialIdSync('ALR');
      await appendRows(TABS.alertLog, [{
        alert_id: alertId, alert_datetime: now, alert_type: alert.alertType,
        severity: alert.severity, brand_id: '', outlet_id: '',
        location_id: body.location_id, item_id: body.item_id,
        reference_type: 'batch', reference_id: body.batch_number,
        title: alert.title, message: alert.message, status: 'OPEN',
        assigned_to: '', due_date: today, action_required: alert.actionRequired,
        telegram_status: 'QUEUED', created_at: now, resolved_at: '', resolved_by: ''
      }]).catch(() => null);
    }
  }

  await logAudit({
    module: 'warehouse', action: 'create', recordType: 'batch_stock',
    recordId: id, afterValue: JSON.stringify(row), userId: s.userId
  }).catch(() => null);

  return ok(row, 201);
});

function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00');
  const b = new Date(to + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
