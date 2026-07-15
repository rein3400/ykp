/**
 * Waste — writes to warehouse_waste (new schema).
 * Photo still required. Phase 3 will expand with approval + auto ledger.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, formatDateWib, formatTimeWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  const rows = await readTab<Record<string, string>>(TABS.waste);
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  // Business rule: waste wajib foto, tanpa foto = tidak diakui
  if (!body.photo_url) {
    return badRequest('Waste wajib foto. Tanpa foto = tidak diakui.');
  }
  const id = nextSequentialIdSync('WST');
  const unitCost = Number(body.estimated_unit_cost || body.buy_price || 0);
  const qty = Number(body.qty || 0);
  const row: Record<string, string> = {
    waste_id: id,
    waste_number: id,
    date: body.date ?? formatDateWib(new Date()),
    time: body.time ?? formatTimeWib(new Date()),
    brand_id: body.brand_id ?? '',
    outlet_id: body.outlet_id ?? '',
    location_id: body.location_id ?? '',
    shift_id: body.shift_id ?? body.shift ?? '',
    item_id: body.item_id ?? '',
    menu_id: body.menu_id ?? '',
    batch_reference: body.batch_reference ?? '',
    qty: String(qty),
    unit: body.unit ?? '',
    estimated_unit_cost: String(unitCost),
    estimated_total_value: String(unitCost * qty),
    waste_type: body.waste_type ?? 'OTHER',
    reason: body.reason ?? '',
    root_cause: body.root_cause ?? '',
    photo_url: body.photo_url,
    reported_by: body.reported_by ?? body.pic ?? s.userId,
    witness_by: body.witness_by ?? body.witness_signature ?? '',
    approval_status: 'PENDING',
    approved_by: '',
    related_order_id: body.related_order_id ?? '',
    related_incident_id: body.related_incident_id ?? '',
    preventive_action: body.preventive_action ?? '',
    created_at: nowTimestampWib()
  };
  await appendRows(TABS.waste, [row]);
  await logAudit({
    module: 'warehouse',
    action: 'create',
    recordType: 'waste',
    recordId: id,
    afterValue: JSON.stringify(row),
    userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
