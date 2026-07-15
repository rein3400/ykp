/**
 * Legacy F1 Penerimaan — flat form.
 * Phase 3 will replace this with header+detail warehouse_receiving.
 * Writes to legacy tab for backward compatibility.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, formatDateWib, formatTimeWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  const rows = await readTab<Record<string, string>>(TABS.legacyPenerimaan);
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const id = nextSequentialIdSync('RCV');
  const row = {
    receive_id: id,
    date: body.date ?? formatDateWib(new Date()),
    time: body.time ?? formatTimeWib(new Date()),
    outlet_id: body.outlet_id ?? '',
    pic_stock: body.pic_stock ?? '',
    shift: body.shift ?? '',
    po_number: body.po_number ?? '',
    supplier_id: body.supplier_id ?? '',
    item_id: body.item_id ?? '',
    item_name: body.item_name ?? '',
    qty_order: body.qty_order ?? '0',
    qty_received: body.qty_received ?? '0',
    unit: body.unit ?? '',
    difference: String(Number(body.qty_received || 0) - Number(body.qty_order || 0)),
    condition: body.condition ?? '',
    signed_by: body.signed_by ?? '',
    created_at: nowTimestampWib(),
    created_by: s.userId
  };
  await appendRows(TABS.legacyPenerimaan, [row]);
  await logAudit({
    module: 'warehouse',
    action: 'create',
    recordType: 'penerimaan',
    recordId: id,
    afterValue: JSON.stringify(row),
    userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
