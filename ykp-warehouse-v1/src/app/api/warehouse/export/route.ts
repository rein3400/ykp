/**
 * GET /api/warehouse/export?resource=ledger|stock|batch|summary&item_id=&location_id=&from=&to=
 * Exports warehouse data as CSV (UTF-8 BOM for Excel). RBAC: export action.
 * Returns a downloadable CSV file.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { unauthorized, forbidden, badRequest, handler } from '@/lib/http';
import { can, type Role } from '@/lib/rbac';
import { toCsv } from '@/lib/csv';

const RESOURCES = ['ledger', 'stock', 'batch', 'summary'] as const;
type Resource = (typeof RESOURCES)[number];

const HEADERS: Record<Resource, string[]> = {
  ledger: ['movement_id', 'movement_datetime', 'item_id', 'location_id', 'movement_type', 'direction', 'quantity', 'base_unit', 'unit_cost', 'total_value', 'reference_type', 'reference_id', 'stock_before', 'stock_after', 'created_by', 'created_at'],
  stock: ['item_id', 'item_name', 'location_id', 'book_stock', 'reorder_point', 'available_stock', 'days_of_cover', 'criticality', 'active_status'],
  batch: ['batch_id', 'item_id', 'location_id', 'batch_number', 'current_qty', 'expiry_date', 'status', 'created_at'],
  summary: ['summary_id', 'date', 'brand_name', 'outlet_name', 'total_inventory_value', 'critical_low_stock_count', 'stockout_risk_count', 'near_expiry_item_count', 'expired_item_count', 'waste_value', 'unexplained_variance_value', 'estimated_purchase_value', 'major_warehouse_issue', 'created_at'],
};

const TAB: Record<Resource, keyof typeof TABS> = {
  ledger: 'stockMovement',
  stock: 'items',
  batch: 'batchStock',
  summary: 'dailySummary',
};

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'export', 'stock_ledger')) return forbidden('Forbidden');

  const q = req.nextUrl.searchParams;
  const resource = (q.get('resource') ?? '') as Resource;
  if (!RESOURCES.includes(resource)) return badRequest(`resource must be one of: ${RESOURCES.join(', ')}`);
  const itemId = q.get('item_id') ?? '';
  const locationId = q.get('location_id') ?? '';
  const from = q.get('from') ?? '';
  const to = q.get('to') ?? '';

  const rows = await readTab<Record<string, string>>(TABS[TAB[resource]]);
  let filtered = rows;
  if (itemId) filtered = filtered.filter((r) => r.item_id === itemId);
  if (locationId) filtered = filtered.filter((r) => r.location_id === locationId);
  if (from) filtered = filtered.filter((r) => (r.date ?? r.movement_datetime ?? '') >= from);
  if (to) filtered = filtered.filter((r) => (r.date ?? r.movement_datetime ?? '') <= to);

  const csv = toCsv(HEADERS[resource], filtered);
  const filename = `ykp-warehouse-${resource}-${from || 'all'}-${to || 'all'}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
