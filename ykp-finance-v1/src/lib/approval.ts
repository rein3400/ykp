/**
 * Approval FSM for finance transactions (ported from ykp-erp engine approval.ts,
 * keeping its bug fixes: CANCELLED allowed from DRAFT/PENDING/APPROVED;
 * REJECTED/PAID/CANCELLED terminal).
 *
 * Valid transitions enforce role amount thresholds (e.g. petty cash > 500k
 * requires FINANCE_ADMIN, not OUTLET_MANAGER). Pure — no I/O.
 */

export type ApprovalStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED';
export type ApprovalEntity = 'expense' | 'petty_cash' | 'supplier_cost';

export interface ApprovalRow {
  id: string;
  entity: ApprovalEntity;
  amount: number;
  status: ApprovalStatus;
  approvedBy?: string | null;
  brandId?: string;
  outletId?: string;
}

export interface TransitionResult {
  ok: boolean;
  new_row: ApprovalRow;
  audit_action: string;
  error?: string;
}

const ALLOWED_TRANSITIONS: ReadonlyArray<[ApprovalStatus, ApprovalStatus]> = [
  ['DRAFT', 'PENDING'],
  ['DRAFT', 'CANCELLED'],
  ['PENDING', 'APPROVED'],
  ['PENDING', 'REJECTED'],
  ['PENDING', 'CANCELLED'],
  ['APPROVED', 'PAID'],
  ['APPROVED', 'CANCELLED']
];

/** Role tiers per entity. Actor role must appear with maxAmount >= row amount. */
const ROLE_THRESHOLDS: Record<ApprovalEntity, { role: string; maxAmount: number }[]> = {
  expense: [
    { role: 'outlet_manager', maxAmount: 500_000 },
    { role: 'finance_admin', maxAmount: 50_000_000 },
    { role: 'super_admin', maxAmount: Number.POSITIVE_INFINITY },
    { role: 'owner', maxAmount: Number.POSITIVE_INFINITY }
  ],
  petty_cash: [
    { role: 'outlet_manager', maxAmount: 500_000 },
    { role: 'finance_admin', maxAmount: 10_000_000 },
    { role: 'super_admin', maxAmount: Number.POSITIVE_INFINITY },
    { role: 'owner', maxAmount: Number.POSITIVE_INFINITY }
  ],
  supplier_cost: [
    { role: 'finance_admin', maxAmount: 100_000_000 },
    { role: 'super_admin', maxAmount: Number.POSITIVE_INFINITY },
    { role: 'owner', maxAmount: Number.POSITIVE_INFINITY }
  ]
};

export function isTransitionAllowed(from: ApprovalStatus, to: ApprovalStatus): boolean {
  return ALLOWED_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

export function canApproveAmount(entity: ApprovalEntity, amount: number, role: string): boolean {
  const tiers = ROLE_THRESHOLDS[entity];
  return tiers.some((t) => t.role === role && amount <= t.maxAmount);
}

/**
 * Attempt a transition. Returns ok=false (with error) when:
 *   - transition is not in ALLOWED_TRANSITIONS,
 *   - actor's role cannot approve the amount for this entity,
 *   - the target status requires approval authority the actor lacks.
 */
export function transitionApproval(
  row: ApprovalRow,
  fromStatus: ApprovalStatus,
  toStatus: ApprovalStatus,
  actor: { id: string; role: string }
): TransitionResult {
  const auditAction = `approval:${fromStatus}->${toStatus}`;
  const fail = (error: string): TransitionResult => ({
    ok: false,
    new_row: row,
    audit_action: `approval-denied:${fromStatus}->${toStatus}`,
    error
  });

  if (row.status !== fromStatus) {
    return fail(`row status ${row.status} does not match from_status ${fromStatus}`);
  }
  if (!isTransitionAllowed(fromStatus, toStatus)) {
    return fail(`transition ${fromStatus}->${toStatus} not allowed`);
  }
  if (toStatus === 'APPROVED' || toStatus === 'PAID') {
    if (!canApproveAmount(row.entity, row.amount, actor.role)) {
      return fail(`role ${actor.role} cannot approve amount ${row.amount} for entity ${row.entity}`);
    }
  }

  return {
    ok: true,
    new_row: {
      ...row,
      status: toStatus,
      approvedBy: toStatus === 'APPROVED' || toStatus === 'PAID' ? actor.id : row.approvedBy
    },
    audit_action: auditAction
  };
}
