/**
 * Rules Engine per brief §19 + §22.2.
 *
 * Pure evaluation functions — no I/O. Callers pass computed metrics,
 * engine returns alert candidates with type + severity.
 *
 * 14 alert types:
 * LOW_STOCK, STOCKOUT_RISK, OVERSTOCK, PURCHASE_REQUIRED,
 * RECEIVING_DISCREPANCY, TRANSFER_DISCREPANCY, WASTE_OVER_LIMIT,
 * STOCK_VARIANCE, NEAR_EXPIRY, EXPIRED_STOCK,
 * MISSING_RECEIPT, UNAPPROVED_ADJUSTMENT, RECOUNT_OVERDUE, ACTION_OVERDUE
 */
export type AlertType =
  | 'LOW_STOCK' | 'STOCKOUT_RISK' | 'OVERSTOCK' | 'PURCHASE_REQUIRED'
  | 'RECEIVING_DISCREPANCY' | 'TRANSFER_DISCREPANCY' | 'WASTE_OVER_LIMIT'
  | 'STOCK_VARIANCE' | 'NEAR_EXPIRY' | 'EXPIRED_STOCK'
  | 'MISSING_RECEIPT' | 'UNAPPROVED_ADJUSTMENT' | 'RECOUNT_OVERDUE' | 'ACTION_OVERDUE';

export type AlertSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AlertCandidate {
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  actionRequired: string;
  itemId?: string;
  brandId?: string;
  outletId?: string;
  locationId?: string;
  referenceType?: string;
  referenceId?: string;
}

/** LOW_STOCK: available <= reorder_point */
export function evalLowStock(available: number, reorderPoint: number, itemName: string, itemId: string): AlertCandidate | null {
  if (available > reorderPoint) return null;
  const severity: AlertSeverity = available <= 0 ? 'CRITICAL' : 'HIGH';
  return {
    alertType: 'LOW_STOCK',
    severity,
    title: `Low stock: ${itemName}`,
    message: `Available stock ${available} <= reorder point ${reorderPoint}`,
    actionRequired: 'Review purchase recommendation and confirm PO',
    itemId
  };
}

/** STOCKOUT_RISK: days_of_cover < lead_time */
export function evalStockoutRisk(daysOfCover: number | null, leadTimeDays: number, itemName: string, itemId: string): AlertCandidate | null {
  if (daysOfCover === null || daysOfCover >= leadTimeDays) return null;
  return {
    alertType: 'STOCKOUT_RISK',
    severity: daysOfCover <= 0 ? 'CRITICAL' : 'HIGH',
    title: `Stockout risk: ${itemName}`,
    message: `Days of cover ${daysOfCover.toFixed(1)} < lead time ${leadTimeDays} hari`,
    actionRequired: 'Confirm purchase immediately',
    itemId
  };
}

/** OVERSTOCK: available > maximum_stock */
export function evalOverstock(available: number, maximumStock: number, itemName: string, itemId: string): AlertCandidate | null {
  if (maximumStock <= 0 || available <= maximumStock) return null;
  return {
    alertType: 'OVERSTOCK',
    severity: 'MEDIUM',
    title: `Overstock: ${itemName}`,
    message: `Available ${available} > max stock ${maximumStock}`,
    actionRequired: 'Review transfer or reduce purchase',
    itemId
  };
}

/** RECEIVING_DISCREPANCY: qty_accepted < qty_ordered OR condition not GOOD */
export function evalReceivingDiscrepancy(
  qtyOrdered: number, qtyAccepted: number, condition: string,
  itemName: string, receivingId: string, itemId: string
): AlertCandidate | null {
  if (qtyAccepted >= qtyOrdered && condition === 'GOOD') return null;
  const reasons: string[] = [];
  if (qtyAccepted < qtyOrdered) reasons.push(`accepted ${qtyAccepted} < ordered ${qtyOrdered}`);
  if (condition !== 'GOOD') reasons.push(`condition: ${condition}`);
  return {
    alertType: 'RECEIVING_DISCREPANCY',
    severity: condition === 'EXPIRED' || condition === 'DAMAGED' ? 'HIGH' : 'MEDIUM',
    title: `Receiving discrepancy: ${itemName}`,
    message: reasons.join('; '),
    actionRequired: 'Claim to supplier today',
    itemId,
    referenceType: 'receiving',
    referenceId: receivingId
  };
}

/** TRANSFER_DISCREPANCY: received_qty != dispatched_qty */
export function evalTransferDiscrepancy(
  dispatchedQty: number, receivedQty: number,
  itemName: string, transferId: string, itemId: string
): AlertCandidate | null {
  if (dispatchedQty === receivedQty) return null;
  const diff = receivedQty - dispatchedQty;
  return {
    alertType: 'TRANSFER_DISCREPANCY',
    severity: Math.abs(diff) > dispatchedQty * 0.1 ? 'HIGH' : 'MEDIUM',
    title: `Transfer discrepancy: ${itemName}`,
    message: `Dispatched ${dispatchedQty}, received ${receivedQty}, difference ${diff}`,
    actionRequired: 'Investigate transfer and recount',
    itemId,
    referenceType: 'transfer',
    referenceId: transferId
  };
}

/** WASTE_OVER_LIMIT: waste_value > threshold */
export function evalWasteOverLimit(
  wasteValue: number, threshold: number,
  itemName: string, wasteId: string, itemId: string
): AlertCandidate | null {
  if (threshold <= 0 || wasteValue <= threshold) return null;
  return {
    alertType: 'WASTE_OVER_LIMIT',
    severity: wasteValue > threshold * 2 ? 'CRITICAL' : 'HIGH',
    title: `Waste over limit: ${itemName}`,
    message: `Waste value ${wasteValue} > threshold ${threshold}`,
    actionRequired: 'Review root cause and preventive action',
    itemId,
    referenceType: 'waste',
    referenceId: wasteId
  };
}

/**
 * STOCK_VARIANCE: variance % > tolerance % OR variance value > tolerance value.
 * Uses "unexplained stock variance" terminology (brief §3.1).
 */
export function evalStockVariance(
  varianceQty: number, variancePct: number, varianceValue: number,
  tolerancePct: number, toleranceValue: number,
  itemName: string, countId: string, itemId: string
): AlertCandidate | null {
  const overPct = Math.abs(variancePct) > tolerancePct;
  const overValue = toleranceValue > 0 && Math.abs(varianceValue) > toleranceValue;
  if (!overPct && !overValue) return null;

  let severity: AlertSeverity = 'MEDIUM';
  if (Math.abs(variancePct) > tolerancePct * 2 || Math.abs(varianceValue) > toleranceValue * 2) severity = 'CRITICAL';
  else if (Math.abs(variancePct) > tolerancePct * 1.5) severity = 'HIGH';

  return {
    alertType: 'STOCK_VARIANCE',
    severity,
    title: `Unexplained stock variance: ${itemName}`,
    message: `Variance ${varianceQty} (${variancePct.toFixed(1)}%, value ${varianceValue}) exceeds tolerance (${tolerancePct}% / ${toleranceValue})`,
    actionRequired: 'Recount required before confirming loss',
    itemId,
    referenceType: 'stock_count',
    referenceId: countId
  };
}

/** NEAR_EXPIRY: days until expiry <= warningDays */
export function evalNearExpiry(
  daysUntilExpiry: number, warningDays: number, currentQty: number,
  itemName: string, batchNumber: string, itemId: string
): AlertCandidate | null {
  if (currentQty <= 0 || daysUntilExpiry > warningDays || daysUntilExpiry < 0) return null;
  return {
    alertType: 'NEAR_EXPIRY',
    severity: daysUntilExpiry <= 3 ? 'HIGH' : 'MEDIUM',
    title: `Near expiry: ${itemName}`,
    message: `Batch ${batchNumber}: ${currentQty} units expire in ${daysUntilExpiry} days`,
    actionRequired: 'Transfer, promo, or use before expiry (FEFO)',
    itemId,
    referenceType: 'batch',
    referenceId: batchNumber
  };
}

/** EXPIRED_STOCK: expiry_date < today AND qty > 0 */
export function evalExpiredStock(
  daysUntilExpiry: number, currentQty: number,
  itemName: string, batchNumber: string, itemId: string
): AlertCandidate | null {
  if (currentQty <= 0 || daysUntilExpiry >= 0) return null;
  return {
    alertType: 'EXPIRED_STOCK',
    severity: 'CRITICAL',
    title: `Expired stock: ${itemName}`,
    message: `Batch ${batchNumber}: ${currentQty} units expired ${Math.abs(daysUntilExpiry)} days ago`,
    actionRequired: 'Quarantine and dispose; record as waste',
    itemId,
    referenceType: 'batch',
    referenceId: batchNumber
  };
}

/** RECOUNT_OVERDUE: due_date passed and investigation not resolved */
export function evalRecountOverdue(
  dueDate: string, investigationStatus: string,
  itemName: string, countId: string, itemId: string, today: string
): AlertCandidate | null {
  if (!dueDate || dueDate >= today) return null;
  if (['RESOLVED', 'EXPLAINED', 'CONFIRMED_LOSS', 'NOT_REQUIRED'].includes(investigationStatus)) return null;
  return {
    alertType: 'RECOUNT_OVERDUE',
    severity: 'HIGH',
    title: `Recount overdue: ${itemName}`,
    message: `Due date ${dueDate} passed, status: ${investigationStatus}`,
    actionRequired: 'Complete recount and investigation',
    itemId,
    referenceType: 'stock_count',
    referenceId: countId
  };
}

/** ACTION_OVERDUE: action status not DONE and due_date passed */
export function evalActionOverdue(
  dueDate: string, status: string,
  title: string, actionId: string, today: string
): AlertCandidate | null {
  if (!dueDate || dueDate >= today) return null;
  if (['DONE', 'CANCELLED'].includes(status)) return null;
  return {
    alertType: 'ACTION_OVERDUE',
    severity: 'HIGH',
    title: `Action overdue: ${title}`,
    message: `Due date ${dueDate} passed, status: ${status}`,
    actionRequired: 'Escalate and complete action',
    referenceType: 'action',
    referenceId: actionId
  };
}

/** HIGH/CRITICAL alerts should auto-create actions. */
export function shouldCreateAction(severity: AlertSeverity): boolean {
  return severity === 'HIGH' || severity === 'CRITICAL';
}
