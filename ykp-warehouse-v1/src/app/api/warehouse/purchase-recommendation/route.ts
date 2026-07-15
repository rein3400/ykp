/**
 * Purchase Recommendation API per brief §10.
 * GET: list existing recommendations
 * POST: regenerate recommendations from inventory engine for all active items
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, formatDateWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';
import { bookStock } from '@/lib/stock-ledger';
import { computeRecommendation } from '@/lib/inventory-engine';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'purchase_recommendation')) return unauthorized('Forbidden');
  const rows = await readTab<Record<string, string>>(TABS.purchaseRecommendation);
  return list(rows);
});

/** Regenerate recommendations for all active items */
export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'generate', 'purchase_recommendation')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as { location_id?: string };
  const today = formatDateWib(new Date());
  const now = nowTimestampWib();

  const [items, suppliers, locations] = await Promise.all([
    readTab<Record<string, string>>(TABS.items),
    readTab<Record<string, string>>(TABS.suppliers),
    readTab<Record<string, string>>(TABS.locations)
  ]);

  const supplierMap = new Map(suppliers.map((s) => [s.supplier_id, s]));
  const activeItems = items.filter((i) => i.active_status === 'active');
  const targetLocations = body.location_id
    ? locations.filter((l) => l.location_id === body.location_id)
    : locations.filter((l) => l.active_status === 'active');

  const recommendations: Record<string, string>[] = [];

  for (const item of activeItems) {
    for (const loc of targetLocations) {
      const book = await bookStock(item.item_id, loc.location_id);
      const supplier = supplierMap.get(item.preferred_supplier_id);

      const rec = computeRecommendation({
        itemId: item.item_id,
        itemName: item.item_name,
        brandId: item.brand_id || loc.brand_id,
        outletId: loc.outlet_id,
        locationId: loc.location_id,
        averageDailyUsage: Number(item.average_daily_usage || 0),
        supplierLeadTimeDays: Number(item.supplier_lead_time_days || supplier?.lead_time_days || 1),
        safetyStock: Number(item.safety_stock || 0),
        maximumStock: Number(item.maximum_stock || 0),
        bookStock: book,
        reservedQty: 0,
        confirmedIncomingTransfer: 0,
        confirmedIncomingPO: 0,
        packSize: Number(item.pack_size || 1),
        minimumOrderQuantity: Number(item.minimum_order_quantity || 1),
        supplierMinimumOrder: Number(supplier?.minimum_order_value || 0) > 0
          ? Math.ceil(Number(supplier!.minimum_order_value) / Number(item.average_purchase_price || 1))
          : 0,
        estimatedUnitPrice: Number(item.average_purchase_price || item.latest_purchase_price || 0),
        purchaseUnit: item.purchase_unit || item.base_unit,
        supplierId: item.preferred_supplier_id,
        supplierName: supplier?.supplier_name
      });

      // Only create recommendations for CRITICAL/HIGH/MEDIUM
      if (rec.priority === 'LOW' && rec.roundedPurchaseQty === 0) continue;

      // Required by date = today + lead_time
      const leadDays = Number(item.supplier_lead_time_days || 1);
      const reqDate = new Date();
      reqDate.setDate(reqDate.getDate() + leadDays);
      const requiredBy = formatDateWib(reqDate);

      const recId = nextSequentialIdSync('PRC');
      recommendations.push({
        recommendation_id: recId,
        date: today,
        item_id: rec.itemId,
        item_name: rec.itemName,
        brand_id: item.brand_id || loc.brand_id || '',
        outlet_id: loc.outlet_id || '',
        location_id: loc.location_id,
        available_stock: String(rec.availableStock),
        average_daily_usage: String(rec.averageDailyUsage),
        days_of_cover: rec.daysOfCover !== null ? rec.daysOfCover.toFixed(1) : 'N/A',
        reorder_point: String(rec.reorderPoint),
        maximum_stock: String(rec.maximumStock),
        incoming_po_qty: String(rec.incomingPoQty),
        reserved_qty: String(rec.reservedQty),
        suggested_purchase_qty: String(rec.suggestedPurchaseQty),
        rounded_purchase_qty: String(rec.roundedPurchaseQty),
        purchase_unit: rec.purchaseUnit,
        supplier_id: rec.supplierId,
        supplier_name: rec.supplierName,
        estimated_unit_price: String(rec.estimatedUnitPrice),
        estimated_purchase_value: String(rec.estimatedPurchaseValue),
        required_by_date: requiredBy,
        priority: rec.priority,
        reason: rec.reason,
        recommendation_status: 'NEW',
        created_at: now,
        approved_by: '',
        approved_at: ''
      });
    }
  }

  if (recommendations.length > 0) {
    await appendRows(TABS.purchaseRecommendation, recommendations);
  }

  await logAudit({
    module: 'warehouse', action: 'generate', recordType: 'purchase_recommendation',
    recordId: today, afterValue: JSON.stringify({ count: recommendations.length }),
    userId: s.userId
  }).catch(() => null);

  return ok({ count: recommendations.length, recommendations }, 201);
});
