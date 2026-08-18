/**
 * @ykp/engine/approval
 *
 * FSM for finance approval transitions per binding contract §7.1.
 * Valid transitions enforce role thresholds (e.g. petty cash > 500k
 * requires FINANCE_ADMIN, not OUTLET_MANAGER).
 *
 * `transitionApproval` returns the updated row + an audit entry ready to
 * insert into audit_log. The caller is responsible for persisting both
 * inside a single transaction.
 */

export type ApprovalStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED";
export type ApprovalEntity = "expense" | "petty_cash" | "supplier_cost" | "payroll";

export interface ApprovalRow {
  id: string;
  entity: ApprovalEntity;
  amount: number;
  status: ApprovalStatus;
  approvedBy?: string | null;
  brandId?: string;
  outletId?: string;
}

export interface AuditEntry {
  auditId: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  before: ApprovalStatus;
  after: ApprovalStatus;
  reason?: string;
  at: Date;
}

export interface TransitionResult {
  ok: boolean;
  new_row: ApprovalRow;
  audit_entry: AuditEntry;
  error?: string;
}

// Defect F8 fix: ALLOWED_TRANSITIONS now includes CANCELLED from DRAFT,
// PENDING, APPROVED. Rejected/Paid/Cancelled are terminal.
const ALLOWED_TRANSITIONS: ReadonlyArray<[ApprovalStatus, ApprovalStatus]> = [
  ["DRAFT", "PENDING"],
  ["DRAFT", "CANCELLED"],
  ["PENDING", "APPROVED"],
  ["PENDING", "REJECTED"],
  ["PENDING", "CANCELLED"],
  ["APPROVED", "PAID"],
  ["APPROVED", "CANCELLED"],
];

const ROLE_THRESHOLDS: Record<ApprovalEntity, { role: string; maxAmount: number }[]> = {
  expense: [
    { role: "OUTLET_MANAGER", maxAmount: 500_000 },
    { role: "FINANCE_ADMIN", maxAmount: 50_000_000 },
    { role: "SUPER_ADMIN", maxAmount: Number.POSITIVE_INFINITY },
    { role: "OWNER", maxAmount: Number.POSITIVE_INFINITY },
  ],
  petty_cash: [
    { role: "OUTLET_MANAGER", maxAmount: 500_000 },
    { role: "FINANCE_ADMIN", maxAmount: 10_000_000 },
    { role: "SUPER_ADMIN", maxAmount: Number.POSITIVE_INFINITY },
    { role: "OWNER", maxAmount: Number.POSITIVE_INFINITY },
  ],
  supplier_cost: [
    { role: "FINANCE_ADMIN", maxAmount: 100_000_000 },
    { role: "SUPER_ADMIN", maxAmount: Number.POSITIVE_INFINITY },
    { role: "OWNER", maxAmount: Number.POSITIVE_INFINITY },
  ],
  payroll: [
    { role: "HR_ADMIN", maxAmount: Number.POSITIVE_INFINITY },
    { role: "SUPER_ADMIN", maxAmount: Number.POSITIVE_INFINITY },
    { role: "OWNER", maxAmount: Number.POSITIVE_INFINITY },
  ],
};

function isTransitionAllowed(from: ApprovalStatus, to: ApprovalStatus): boolean {
  return ALLOWED_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

function canApproveAmount(entity: ApprovalEntity, amount: number, role: string): boolean {
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
  from_status: ApprovalStatus,
  to_status: ApprovalStatus,
  actor: { id: string; role: string },
  reason?: string,
): TransitionResult {
  if (row.status !== from_status) {
    return fail(row, from_status, to_status, actor, reason, "row status does not match from_status");
  }
  if (!isTransitionAllowed(from_status, to_status)) {
    return fail(row, from_status, to_status, actor, reason, `transition ${from_status}->${to_status} not allowed`);
  }
  if (to_status === "APPROVED" || to_status === "PAID") {
    if (!canApproveAmount(row.entity, row.amount, actor.role)) {
      return fail(
        row,
        from_status,
        to_status,
        actor,
        reason,
        `role ${actor.role} cannot approve amount ${row.amount} for entity ${row.entity}`,
      );
    }
  }

  const new_row: ApprovalRow = {
    ...row,
    status: to_status,
    approvedBy: to_status === "APPROVED" || to_status === "PAID" ? actor.id : row.approvedBy,
  };

  const audit_entry: AuditEntry = {
    auditId: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actor: actor.id,
    action: `approval:${from_status}->${to_status}`,
    entity: row.entity,
    entityId: row.id,
    before: from_status,
    after: to_status,
    reason,
    at: new Date(),
  };

  return { ok: true, new_row, audit_entry };
}

function fail(
  row: ApprovalRow,
  from: ApprovalStatus,
  to: ApprovalStatus,
  actor: { id: string; role: string },
  reason: string | undefined,
  error: string,
): TransitionResult {
  return {
    ok: false,
    new_row: row,
    audit_entry: {
      auditId: `AUD-FAIL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actor: actor.id,
      action: `approval-denied:${from}->${to}`,
      entity: row.entity,
      entityId: row.id,
      before: from,
      after: to,
      reason,
      at: new Date(),
    },
    error,
  };
}