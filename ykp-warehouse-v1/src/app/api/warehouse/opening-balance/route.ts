/**
 * Opening Balance API — posts OPENING_BALANCE movement to stock ledger.
 * Used for migration from spreadsheet / initial stock setup.
 * Brief §15 movement type OPENING_BALANCE.
 */
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nextSequentialIdSync, MissingRefError, assertItem, assertLocation } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';
import { appendMovement, bookStock } from '@/lib/stock-ledger';

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'stock_ledger')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as {
    items?: Array<{
      item_id: string;
      location_id: string;
      quantity: number;
      unit_cost?: number;
      brand_id?: string;
      outlet_id?: string;
      base_unit?: string;
      notes?: string;
    }>;
  };

  if (!body.items || body.items.length === 0) return badRequest('items[] required');

  const results = [];
  for (const it of body.items) {
    if (!it.item_id || !it.location_id) return badRequest('item_id and location_id required per row');
    if (it.quantity === undefined || it.quantity === null) return badRequest('quantity required');

    try {
      await assertItem(it.item_id);
      await assertLocation(it.location_id);
    } catch (e) {
      if (e instanceof MissingRefError) return badRequest(e.message);
      throw e;
    }

    // Only allow opening balance if current book is 0 (or force with notes)
    const current = await bookStock(it.item_id, it.location_id);
    if (current !== 0 && !it.notes?.includes('FORCE')) {
      return badRequest(
        `Book stock for ${it.item_id}@${it.location_id} is ${current}, not 0. ` +
        `Use notes containing FORCE to override, or post adjustment.`
      );
    }

    const refId = nextSequentialIdSync('OPB');
    const movement = await appendMovement({
      movementType: 'OPENING_BALANCE',
      direction: 'IN',
      quantity: Math.abs(it.quantity),
      baseUnit: it.base_unit || 'unit',
      unitCost: it.unit_cost || 0,
      itemId: it.item_id,
      brandId: it.brand_id || '',
      outletId: it.outlet_id || '',
      locationId: it.location_id,
      referenceType: 'opening_balance',
      referenceId: refId,
      createdBy: s.userId,
      notes: it.notes || 'Opening balance migration'
    });
    results.push(movement);
  }

  await logAudit({
    module: 'warehouse',
    action: 'create',
    recordType: 'opening_balance',
    recordId: results[0]?.movement_id || '',
    afterValue: JSON.stringify({ count: results.length }),
    userId: s.userId
  }).catch(() => null);

  return ok({ count: results.length, movements: results }, 201);
});
