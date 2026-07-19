/**
 * Lateness approval state machine (pure — vitest covered).
 * hr_lateness rows carry approval_status/approved_by; legacy rows may have an
 * empty approval_status, which the UI already displays as PENDING.
 */

export type ApprovalDecision = 'APPROVE' | 'REJECT';

/** '' (legacy rows) is treated as PENDING — same rule as the lateness page. */
export function normalizeApprovalStatus(status: string | undefined | null): string {
  const s = (status ?? '').trim().toUpperCase();
  return s === '' ? 'PENDING' : s;
}

/**
 * Approval state transition for one lateness row.
 * PENDING → APPROVED | REJECTED. Throws on an unknown decision or when the
 * row was already decided (caller maps that to HTTP 409).
 */
export function nextApprovalStatus(
  current: string | undefined | null,
  decision: ApprovalDecision
): string {
  if (decision !== 'APPROVE' && decision !== 'REJECT') {
    throw new Error(`Unknown decision: ${decision}`);
  }
  if (normalizeApprovalStatus(current) !== 'PENDING') {
    throw new Error('Lateness already decided');
  }
  return decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
}
