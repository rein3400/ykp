import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertCategory, assertSupplier } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'item')) return unauthorized('Forbidden');
  const rows = await readTab<Record<string, string>>(TABS.items);
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'item')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.item_name) return badRequest('item_name is required');
  if (!body.base_unit) return badRequest('base_unit is required');

  try {
    if (body.category_id) await assertCategory(body.category_id);
    if (body.preferred_supplier_id) await assertSupplier(body.preferred_supplier_id);
    if (body.backup_supplier_id) await assertSupplier(body.backup_supplier_id);
  } catch (e) {
    if (e instanceof MissingRefError) return badRequest(e.message);
    throw e;
  }

  const itemId = nextSequentialIdSync('ITM');
  const now = nowTimestampWib();
  const row: Record<string, string> = {
    item_id: itemId,
    item_code: body.item_code || itemId,
    item_name: body.item_name,
    brand_id: body.brand_id ?? '',
    category_id: body.category_id ?? '',
    item_type: body.item_type ?? 'RAW_MATERIAL',
    base_unit: body.base_unit,
    purchase_unit: body.purchase_unit || body.base_unit,
    conversion_factor: body.conversion_factor ?? '1',
    pack_size: body.pack_size ?? '1',
    minimum_order_quantity: body.minimum_order_quantity ?? '1',
    preferred_supplier_id: body.preferred_supplier_id ?? '',
    backup_supplier_id: body.backup_supplier_id ?? '',
    latest_purchase_price: body.latest_purchase_price ?? '0',
    average_purchase_price: body.average_purchase_price ?? body.latest_purchase_price ?? '0',
    minimum_stock: body.minimum_stock ?? '0',
    safety_stock: body.safety_stock ?? '0',
    maximum_stock: body.maximum_stock ?? '0',
    reorder_point: body.reorder_point ?? '0',
    average_daily_usage: body.average_daily_usage ?? '0',
    supplier_lead_time_days: body.supplier_lead_time_days ?? '1',
    supplier_order_day: body.supplier_order_day ?? '',
    supplier_delivery_day: body.supplier_delivery_day ?? '',
    expiry_days: body.expiry_days ?? '0',
    criticality: body.criticality ?? 'MEDIUM',
    tolerance_variance_percentage: body.tolerance_variance_percentage ?? '5',
    tolerance_variance_value: body.tolerance_variance_value ?? '0',
    recipe_linked_status: body.recipe_linked_status ?? 'NO',
    active_status: 'active',
    created_at: now,
    updated_at: now,
    created_by: s.userId,
    updated_by: s.userId
  };

  await appendRows(TABS.items, [row]);
  await logAudit({
    module: 'warehouse',
    action: 'create',
    recordType: 'item',
    recordId: itemId,
    afterValue: JSON.stringify(row),
    userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
