/**
 * Inventory Calculation Engine per brief §10 + §22.1.
 *
 * Pure functions — no I/O. Callers pass data, engine computes:
 * - reorderPoint
 * - availableStock
 * - daysOfCover
 * - suggestedPurchase (with pack/MOQ rounding)
 * - priority
 */
export interface ItemStockParams {
  averageDailyUsage: number;
  supplierLeadTimeDays: number;
  safetyStock: number;
  maximumStock: number;
  bookStock: number;
  reservedQty: number;
  confirmedIncomingTransfer: number;
  confirmedIncomingPO: number;
  packSize: number;
  minimumOrderQuantity: number;
  supplierMinimumOrder?: number;
}

export type PurchasePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Reorder Point = avg_daily_usage × lead_time + safety_stock */
export function reorderPoint(p: Pick<ItemStockParams, 'averageDailyUsage' | 'supplierLeadTimeDays' | 'safetyStock'>): number {
  return p.averageDailyUsage * p.supplierLeadTimeDays + p.safetyStock;
}

/** Available Stock = book - reserved + confirmed_incoming_transfer + confirmed_incoming_PO */
export function availableStock(p: Pick<ItemStockParams, 'bookStock' | 'reservedQty' | 'confirmedIncomingTransfer' | 'confirmedIncomingPO'>): number {
  return p.bookStock - p.reservedQty + p.confirmedIncomingTransfer + p.confirmedIncomingPO;
}

/**
 * Days of Cover = available / avg_daily_usage.
 * Returns null (N/A) when avg_daily_usage is 0 — never divide by zero.
 */
export function daysOfCover(available: number, averageDailyUsage: number): number | null {
  if (averageDailyUsage <= 0) return null;
  return available / averageDailyUsage;
}

/**
 * Suggested Purchase = max_stock - available - confirmed_incoming_PO + reserved.
 * Floored at 0. Rounded up to pack_size and MOQ.
 */
export function suggestedPurchase(p: ItemStockParams): {
  raw: number;
  rounded: number;
  packSize: number;
  moq: number;
} {
  const available = availableStock(p);
  const raw = Math.max(0, p.maximumStock - available - p.confirmedIncomingPO + p.reservedQty);
  const pack = Math.max(1, p.packSize || 1);
  const moq = Math.max(1, p.minimumOrderQuantity || 1);
  const supplierMin = p.supplierMinimumOrder ?? 0;

  // Round up to pack size
  let rounded = Math.ceil(raw / pack) * pack;
  // Enforce MOQ
  if (rounded > 0 && rounded < moq) rounded = moq;
  // Enforce supplier minimum
  if (rounded > 0 && supplierMin > 0 && rounded < supplierMin) {
    rounded = Math.ceil(supplierMin / pack) * pack;
  }

  return { raw, rounded, packSize: pack, moq };
}

/**
 * Priority classification:
 * CRITICAL: days_of_cover < lead_time OR available <= 0
 * HIGH: available <= reorder_point
 * MEDIUM: available <= reorder_point * 1.5
 * LOW: otherwise
 */
export function priority(p: ItemStockParams): PurchasePriority {
  const available = availableStock(p);
  const doc = daysOfCover(available, p.averageDailyUsage);
  const rp = reorderPoint(p);

  if (available <= 0) return 'CRITICAL';
  if (doc !== null && doc < p.supplierLeadTimeDays) return 'CRITICAL';
  if (available <= rp) return 'HIGH';
  if (available <= rp * 1.5) return 'MEDIUM';
  return 'LOW';
}

/** Full recommendation snapshot for one item. */
export function computeRecommendation(p: ItemStockParams & {
  itemId: string;
  itemName: string;
  brandId?: string;
  outletId?: string;
  locationId?: string;
  supplierId?: string;
  supplierName?: string;
  estimatedUnitPrice?: number;
  purchaseUnit?: string;
}): {
  itemId: string;
  itemName: string;
  availableStock: number;
  averageDailyUsage: number;
  daysOfCover: number | null;
  reorderPoint: number;
  maximumStock: number;
  incomingPoQty: number;
  reservedQty: number;
  suggestedPurchaseQty: number;
  roundedPurchaseQty: number;
  purchaseUnit: string;
  supplierId: string;
  supplierName: string;
  estimatedUnitPrice: number;
  estimatedPurchaseValue: number;
  priority: PurchasePriority;
  reason: string;
} {
  const available = availableStock(p);
  const doc = daysOfCover(available, p.averageDailyUsage);
  const rp = reorderPoint(p);
  const sug = suggestedPurchase(p);
  const prio = priority(p);
  const unitPrice = p.estimatedUnitPrice ?? 0;

  let reason = '';
  if (prio === 'CRITICAL') {
    reason = available <= 0
      ? 'Stockout — available stock <= 0'
      : `Days of cover (${doc?.toFixed(1)}) < lead time (${p.supplierLeadTimeDays} hari)`;
  } else if (prio === 'HIGH') {
    reason = `Available (${available}) <= reorder point (${rp})`;
  } else if (prio === 'MEDIUM') {
    reason = `Available approaching reorder point`;
  } else {
    reason = 'Normal monitoring';
  }

  return {
    itemId: p.itemId,
    itemName: p.itemName,
    availableStock: available,
    averageDailyUsage: p.averageDailyUsage,
    daysOfCover: doc,
    reorderPoint: rp,
    maximumStock: p.maximumStock,
    incomingPoQty: p.confirmedIncomingPO,
    reservedQty: p.reservedQty,
    suggestedPurchaseQty: sug.raw,
    roundedPurchaseQty: sug.rounded,
    purchaseUnit: p.purchaseUnit ?? 'unit',
    supplierId: p.supplierId ?? '',
    supplierName: p.supplierName ?? '',
    estimatedUnitPrice: unitPrice,
    estimatedPurchaseValue: Math.round(sug.rounded * unitPrice),
    priority: prio,
    reason
  };
}
