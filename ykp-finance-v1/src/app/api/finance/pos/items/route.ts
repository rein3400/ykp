/**
 * PUBLIC (owner layer): item-level POS sales read endpoint.
 * GET /api/finance/pos/items?from=YYYY-MM-DD&to=YYYY-MM-DD&outlet_id=&item=
 * Auth is bypassed for GET in middleware.ts (PUBLIC_GET_PREFIXES).
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { list, handler } from '@/lib/http';

export const GET = handler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';
  const outletId = q.get('outlet_id') ?? '';
  const item = (q.get('item') ?? '').toLowerCase();
  let rows = await readTab<Record<string, string>>(TABS.posItems);
  if (from) rows = rows.filter((r) => r.date >= from);
  if (to) rows = rows.filter((r) => r.date <= to);
  if (outletId) rows = rows.filter((r) => r.outlet_id === outletId);
  if (item) rows = rows.filter((r) => (r.item_name ?? '').toLowerCase().includes(item));
  rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (a.outlet_id ?? '').localeCompare(b.outlet_id ?? ''));
  return list(rows);
});
