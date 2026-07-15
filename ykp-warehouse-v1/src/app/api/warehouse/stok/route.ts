/**
 * Legacy F2 Kartu Stok — read-only.
 * Phase 2 will replace this with warehouse_stock_movement ledger.
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { list, unauthorized, handler } from '@/lib/http';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  const url = new URL(req.url);
  const itemId = url.searchParams.get('item_id');
  const rows = await readTab<Record<string, string>>(TABS.legacyKartuStok);
  const filtered = itemId ? rows.filter((r) => r.item_id === itemId) : rows;
  return list(filtered);
});
