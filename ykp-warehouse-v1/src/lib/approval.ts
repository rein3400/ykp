/**
 * Approval workflow helper per brief §28.
 *
 * Status: DRAFT → PENDING → APPROVED | REJECTED | ESCALATED | CANCELLED
 * All approval records store: requested_by, approved_by, approved_at, reason.
 */
export type ApprovalStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'CANCELLED';

export const APPROVAL_TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['APPROVED', 'REJECTED', 'ESCALATED', 'CANCELLED'],
  APPROVED: [],
  REJECTED: ['PENDING'], // can re-submit
  ESCALATED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  CANCELLED: []
};

export function canTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
  return (APPROVAL_TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from: ApprovalStatus, to: ApprovalStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid approval transition: ${from} → ${to}`);
  }
}

/** Entities that require approval per brief §28. */
export const REQUIRES_APPROVAL = [
  'purchase_request',
  'receiving_discrepancy',
  'waste_over_threshold',
  'stock_adjustment',
  'confirmed_loss',
  'transfer',
  'reopen_stock_count',
  'reversal_movement',
  'threshold_change',
  'master_item_price_change',
  'unit_conversion_change'
] as const;

export type ApprovalEntity = (typeof REQUIRES_APPROVAL)[number];
