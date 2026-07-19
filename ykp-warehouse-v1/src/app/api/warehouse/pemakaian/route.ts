/**
 * Legacy F3 Bon Pemakaian — flat form.
 * DEPRECATED: superseded by header+detail warehouse_stock_issue.
 * Writes to the legacy tab only while WAREHOUSE_LEGACY_WRITES_ENABLED != false;
 * when disabled, POST returns 410 Gone.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { legacyWritesEnabled, legacyWritesDisabledResponse } from '@/lib/legacy';
import { nowTimestampWib, formatDateWib, formatTimeWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  const rows = await readTab<Record<string, string>>(TABS.legacyPemakaian);
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!legacyWritesEnabled()) return legacyWritesDisabledResponse();
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const id = nextSequentialIdSync('USE');
  const row = {
    usage_id: id,
    date: body.date ?? formatDateWib(new Date()),
    time: body.time ?? formatTimeWib(new Date()),
    outlet_id: body.outlet_id ?? '',
    item_id: body.item_id ?? '',
    item_name: body.item_name ?? '',
    qty_out: body.qty_out ?? '0',
    unit: body.unit ?? '',
    for_menu: body.for_menu ?? '',
    requested_by: body.requested_by ?? '',
    approved_by_pic: body.approved_by_pic ?? '',
    shift: body.shift ?? '',
    created_at: nowTimestampWib(),
    created_by: s.userId
  };
  await appendRows(TABS.legacyPemakaian, [row]);
  await logAudit({
    module: 'warehouse',
    action: 'create',
    recordType: 'pemakaian',
    recordId: id,
    afterValue: JSON.stringify(row),
    userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
