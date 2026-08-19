/**
 * Stock Movement Ledger — auto immutable per brief §15.
 *
 * Every stock-affecting transaction (receiving, issue, transfer, waste, adjustment)
 * MUST call appendMovement() to record the movement. The ledger is append-only;
 * corrections go through reversal (new movement referencing the original).
 *
 * bookStock(item_id, location_id) computes current stock from ledger aggregation.
 * duplicate reference_id is rejected to prevent double-counting.
 */
import { readTab, appendRows, findRow, TABS } from '@/db/sheets';
import { nowTimestampWib } from './format';
import { nextSequentialIdSync } from './repo';

export type MovementType =
  | 'OPENING_BALANCE' | 'RECEIPT' | 'ISSUE'
  | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'WASTE'
  | 'RETURN_IN' | 'RETURN_OUT' | 'COUNT_ADJUSTMENT'
  | 'REVERSAL' | 'PRODUCTION_IN' | 'PRODUCTION_OUT';

export type MovementDirection = 'IN' | 'OUT' | 'ADJUSTMENT';

export interface MovementParams {
  movementType: MovementType;
  direction: MovementDirection;
  quantity: number;
  baseUnit: string;
  unitCost: number;
  itemId: string;
  brandId: string;
  outletId: string;
  locationId: string;
  referenceType: string;
  referenceId: string;
  sourceLocationId?: string;
  destinationLocationId?: string;
  createdBy: string;
  approvedBy?: string;
  notes?: string;
  environment?: string;
}

export interface MovementRow extends Record<string, string> {
  movement_id: string;
  movement_number: string;
  movement_datetime: string;
  item_id: string;
  brand_id: string;
  outlet_id: string;
  location_id: string;
  movement_type: string;
  direction: string;
  quantity: string;
  base_unit: string;
  unit_cost: string;
  total_value: string;
  reference_type: string;
  reference_id: string;
  source_location_id: string;
  destination_location_id: string;
  stock_before: string;
  stock_after: string;
  created_by: string;
  approved_by: string;
  notes: string;
  environment: string;
  created_at: string;
}

/**
 * Append one movement to the ledger. Auto-computes stock_before/after
 * from the last movement for the same (item, location). Rejects duplicate
 * reference_id to prevent double-counting.
 */
export async function appendMovement(p: MovementParams): Promise<MovementRow> {
  // Reject duplicate reference
  if (p.referenceId) {
    const dup = await findRow(TABS.stockMovement, 'reference_id', p.referenceId);
    if (dup) {
      throw new Error(`Duplicate reference_id: ${p.referenceId} already exists in stock_movement`);
    }
  }

  // Compute stock_before from last movement for this (item, location)
  const all = await readTab<Record<string, string>>(TABS.stockMovement);
  const sameItem = all.filter((m) => m.item_id === p.itemId && m.location_id === p.locationId);
  const last = sameItem.length > 0
    ? sameItem.reduce((a, b) => (a.movement_datetime > b.movement_datetime ? a : b))
    : null;
  const stockBefore = last ? Number(last.stock_after || 0) : 0;

  // Compute stock_after
  let stockAfter: number;
  if (p.direction === 'IN') {
    stockAfter = stockBefore + p.quantity;
  } else if (p.direction === 'OUT') {
    // Prevent negative stock: an OUT that would drive stock below zero is
    // rejected. This catches over-issue / over-transfer / over-waste before
    // it corrupts the ledger.
    if (p.quantity > stockBefore) {
      throw new Error(
        `Insufficient stock: ${p.itemId} @ ${p.locationId} has ${stockBefore}, cannot move OUT ${p.quantity}`
      );
    }
    stockAfter = stockBefore - p.quantity;
  } else {
    // ADJUSTMENT — can be positive or negative
    stockAfter = stockBefore + p.quantity;
  }

  const totalValue = Math.round(p.quantity * p.unitCost);
  const now = nowTimestampWib();
  const movementId = nextSequentialIdSync('MV');
  const row: MovementRow = {
    movement_id: movementId,
    movement_number: movementId,
    movement_datetime: now,
    item_id: p.itemId,
    brand_id: p.brandId,
    outlet_id: p.outletId,
    location_id: p.locationId,
    movement_type: p.movementType,
    direction: p.direction,
    quantity: String(p.quantity),
    base_unit: p.baseUnit,
    unit_cost: String(p.unitCost),
    total_value: String(totalValue),
    reference_type: p.referenceType,
    reference_id: p.referenceId,
    source_location_id: p.sourceLocationId ?? '',
    destination_location_id: p.destinationLocationId ?? '',
    stock_before: String(stockBefore),
    stock_after: String(stockAfter),
    created_by: p.createdBy,
    approved_by: p.approvedBy ?? '',
    notes: p.notes ?? '',
    environment: p.environment ?? process.env.ENVIRONMENT ?? 'TESTING',
    created_at: now
  };

  await appendRows(TABS.stockMovement, [row]);
  return row;
}

/**
 * Compute current book stock for an item at a location by aggregating
 * all movements. Returns the last stock_after value, or 0 if no movements.
 */
export async function bookStock(itemId: string, locationId: string): Promise<number> {
  const all = await readTab<Record<string, string>>(TABS.stockMovement);
  const same = all.filter((m) => m.item_id === itemId && m.location_id === locationId);
  if (same.length === 0) return 0;
  const last = same.reduce((a, b) => (a.movement_datetime > b.movement_datetime ? a : b));
  // Round to 3dp so float noise (4.69999999999999) never surfaces in UI.
  const n = Number(last.stock_after || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/**
 * Create a reversal movement. References the original movement_id.
 * Reversal is always the opposite direction with the same quantity.
 */
export async function reverseMovement(
  originalMovementId: string,
  reason: string,
  createdBy: string,
  approvedBy?: string
): Promise<MovementRow> {
  const orig = await findRow(TABS.stockMovement, 'movement_id', originalMovementId);
  if (!orig) throw new Error(`Original movement not found: ${originalMovementId}`);

  const origDir = orig.row.direction as MovementDirection;
  const reverseDir: MovementDirection = origDir === 'IN' ? 'OUT' : origDir === 'OUT' ? 'IN' : 'ADJUSTMENT';
  const qty = Number(orig.row.quantity || 0);

  return appendMovement({
    movementType: 'REVERSAL',
    direction: reverseDir,
    quantity: qty,
    baseUnit: orig.row.base_unit,
    unitCost: Number(orig.row.unit_cost || 0),
    itemId: orig.row.item_id,
    brandId: orig.row.brand_id,
    outletId: orig.row.outlet_id,
    locationId: orig.row.location_id,
    referenceType: 'REVERSAL',
    referenceId: `REV-${originalMovementId}`,
    sourceLocationId: orig.row.source_location_id,
    destinationLocationId: orig.row.destination_location_id,
    createdBy,
    approvedBy,
    notes: `Reversal of ${originalMovementId}: ${reason}`,
    environment: orig.row.environment
  });
}
