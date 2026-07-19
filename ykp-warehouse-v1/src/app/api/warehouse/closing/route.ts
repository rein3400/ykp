/**
 * Legacy F5 Closing — flat form.
 * DEPRECATED: superseded by warehouse_stock_count header+detail (Stock Opname).
 * Writes to the legacy tab only while WAREHOUSE_LEGACY_WRITES_ENABLED != false;
 * when disabled, POST returns 410 Gone.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { legacyWritesEnabled, legacyWritesDisabledResponse } from '@/lib/legacy';
import { nowTimestampWib, formatDateWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  const rows = await readTab<Record<string, string>>(TABS.legacyClosing);
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!legacyWritesEnabled()) return legacyWritesDisabledResponse();
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const id = nextSequentialIdSync('CLS');
  const stockOpen = Number(body.stock_open || 0);
  const received = Number(body.received || 0);
  const used = Number(body.used || 0);
  const waste = Number(body.waste || 0);
  const expected = stockOpen + received - used - waste;
  const actual = Number(body.actual_stock || 0);
  const diff = actual - expected;
  const diffPct = expected > 0 ? ((Math.abs(diff) / expected) * 100).toFixed(1) : '0';
  const row = {
    closing_id: id,
    date: body.date ?? formatDateWib(new Date()),
    outlet_id: body.outlet_id ?? '',
    pic_stock: body.pic_stock ?? '',
    shift: body.shift ?? '',
    item_id: body.item_id ?? '',
    item_name: body.item_name ?? '',
    unit: body.unit ?? '',
    stock_open: String(stockOpen),
    received: String(received),
    used: String(used),
    waste: String(waste),
    expected_stock: String(expected),
    actual_stock: String(actual),
    difference: String(diff),
    diff_pct: diffPct,
    status: Math.abs(Number(diffPct)) > 5 ? 'ALERT' : 'OK',
    created_at: nowTimestampWib()
  };
  await appendRows(TABS.legacyClosing, [row]);
  await logAudit({
    module: 'warehouse',
    action: 'create',
    recordType: 'closing',
    recordId: id,
    afterValue: JSON.stringify(row),
    userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
