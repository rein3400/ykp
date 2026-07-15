import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { list, unauthorized, handler } from '@/lib/http';
import { can, type Role } from '@/lib/rbac';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'stock_ledger')) return unauthorized('Forbidden');

  const url = new URL(req.url);
  const itemId = url.searchParams.get('item_id');
  const locationId = url.searchParams.get('location_id');
  const movementType = url.searchParams.get('movement_type');
  const dateFrom = url.searchParams.get('date_from');
  const dateTo = url.searchParams.get('date_to');

  let rows = await readTab<Record<string, string>>(TABS.stockMovement);

  if (itemId) rows = rows.filter((r) => r.item_id === itemId);
  if (locationId) rows = rows.filter((r) => r.location_id === locationId);
  if (movementType) rows = rows.filter((r) => r.movement_type === movementType);
  if (dateFrom) rows = rows.filter((r) => r.movement_datetime >= dateFrom);
  if (dateTo) rows = rows.filter((r) => r.movement_datetime <= dateTo + ' 23:59:59');

  // Sort newest first
  rows.sort((a, b) => b.movement_datetime.localeCompare(a.movement_datetime));

  return list(rows);
});
