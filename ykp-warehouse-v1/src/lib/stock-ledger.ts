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
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { nowTimestampWib, formatDateWib } from './format';
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

  // Compute stock_before from last movement for this (item, location).
  // Tiebreak: when two rows share the same WIB-second movement_datetime (same-second
  // concurrent receipts), the row appended LAST wins — readTab returns rows in sheet
  // (append) order, so a later array index is a later insert. Falling back to the
  // datetime string alone returned an arbitrary row on ties → ledger drift.
  const all = await readTab<Record<string, string>>(TABS.stockMovement);
  let last: Record<string, string> | null = null;
  for (const m of all) {
    if (m.item_id !== p.itemId || m.location_id !== p.locationId) continue;
    if (last === null || m.movement_datetime >= last.movement_datetime) {
      last = m;
    }
  }
  const stockBefore = last ? Number(last.stock_after || 0) : 0;

  // Compute stock_after
  let stockAfter: number;
  if (p.direction === 'IN') {
    stockAfter = stockBefore + p.quantity;
  } else if (p.direction === 'OUT') {
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
  let last: Record<string, string> | null = null;
  for (const m of all) {
    if (m.item_id !== itemId || m.location_id !== locationId) continue;
    // Same-second ties → last appended wins (readTab returns rows in append order).
    if (last === null || m.movement_datetime >= last.movement_datetime) {
      last = m;
    }
  }
  if (!last) return 0;
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

/**
 * Batch stock status from an expiry date relative to today.
 * Used by upsertBatchStock so the status reflects the latest expiry window.
 */
export function batchStatusFromExpiry(today: string, expiryDate: string, qty: number): string {
  if (qty <= 0) return 'DEPLETED';
  if (!expiryDate) return 'ACTIVE';
  const daysUntil = Math.round(
    (new Date(expiryDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000
  );
  if (daysUntil < 0) return 'EXPIRED';
  if (daysUntil <= 7) return 'NEAR_EXPIRY';
  return 'ACTIVE';
}

export interface BatchStockUpsertParams {
  itemId: string;
  locationId: string;
  batchNumber: string;
  expiryDate?: string;
  receivedDate?: string;
  qtyAccepted: number;
  unit: string;
  unitCost: number;
  createdBy?: string;
}

/**
 * Upsert a batch_stock row on a receipt. Locates an existing row keyed by
 * (item_id, location_id, batch_number); if found, increments current_qty and
 * recomputes status; if not, inserts a new batch row. Returns the resulting
 * batch row plus a flag indicating whether it was created or updated.
 *
 * This keeps batch_stock in sync with receiving so FEFO/expiry monitoring and
 * inventory valuation are no longer stale after a receipt.
 */
export async function upsertBatchStockOnReceipt(
  p: BatchStockUpsertParams
): Promise<{ row: Record<string, string>; rowNumber: number | null; created: boolean }> {
  if (!p.itemId || !p.locationId || !p.batchNumber) {
    throw new Error('upsertBatchStockOnReceipt requires item_id, location_id, batch_number');
  }
  const rows = await readTab<Record<string, string>>(TABS.batchStock);
  const idx = rows.findIndex(
    (r) => r.item_id === p.itemId && r.location_id === p.locationId && r.batch_number === p.batchNumber
  );
  const now = nowTimestampWib();
  const today = formatDateWib(new Date());
  const receivedDate = p.receivedDate ?? today;

  if (idx >= 0) {
    const existing = rows[idx];
    const newQty = Number(existing.current_qty || 0) + p.qtyAccepted;
    const status = batchStatusFromExpiry(today, existing.expiry_date ?? p.expiryDate ?? '', newQty);
    const updated: Record<string, string> = {
      ...existing,
      current_qty: String(newQty),
      // Keep the earliest expiry if multiple receipts under the same batch.
      expiry_date: existing.expiry_date || (p.expiryDate ?? ''),
      unit: existing.unit || p.unit,
      unit_cost: existing.unit_cost || String(p.unitCost || 0),
      status,
      updated_at: now
    };
    await updateRow(TABS.batchStock, idx + 2, updated);
    return { row: updated, rowNumber: idx + 2, created: false };
  }

  const id = nextSequentialIdSync('BAT');
  const status = batchStatusFromExpiry(today, p.expiryDate ?? '', p.qtyAccepted);
  const row: Record<string, string> = {
    batch_stock_id: id,
    item_id: p.itemId,
    location_id: p.locationId,
    batch_number: p.batchNumber,
    expiry_date: p.expiryDate ?? '',
    received_date: receivedDate,
    current_qty: String(p.qtyAccepted),
    unit: p.unit,
    unit_cost: String(p.unitCost || 0),
    status,
    created_at: now,
    updated_at: now
  };
  await appendRows(TABS.batchStock, [row]);
  return { row, rowNumber: null, created: true };
}
