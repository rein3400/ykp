/** Exercise the real approval FSM against invalid amounts without any database writes. */
import { describe, expect, it } from 'vitest';
import { transitionApproval, type ApprovalRow, type ApprovalStatus } from '../src/lib/approval';

const actor = { id: 'REVIEWER-1', role: 'owner' };
const invalidAmounts = [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

/** Produce a synthetic row distinct from its approver. */
function row(amount: number, status: ApprovalStatus = 'PENDING'): ApprovalRow {
  return { id: 'EXP-REGRESSION-1', entity: 'expense', amount, status, createdBy: 'MAKER-1', approvedBy: null };
}

describe('approval amount integrity', () => {
  it.each(invalidAmounts)('rejects approval for invalid amount %s without mutating the row', (amount) => {
    const source = row(amount);
    const result = transitionApproval(source, 'PENDING', 'APPROVED', actor);
    expect(result.ok).toBe(false);
    expect(result.new_row).toBe(source);
    expect(source.status).toBe('PENDING');
    expect(result.audit_action).toBe('approval-denied:PENDING->APPROVED');
    expect(result.error).toContain('amount must be > 0');
  });

  it.each(invalidAmounts)('rejects payment for invalid amount %s', (amount) => {
    const source = row(amount, 'APPROVED');
    const result = transitionApproval(source, 'APPROVED', 'PAID', actor);
    expect(result.ok).toBe(false);
    expect(result.new_row).toBe(source);
    expect(source.status).toBe('APPROVED');
    expect(result.audit_action).toBe('approval-denied:APPROVED->PAID');
  });

  it('still approves and pays valid positive amounts', () => {
    const approved = transitionApproval(row(125000), 'PENDING', 'APPROVED', actor);
    expect(approved.ok).toBe(true);
    expect(approved.new_row.status).toBe('APPROVED');
    expect(approved.new_row.approvedBy).toBe('REVIEWER-1');
    const paid = transitionApproval(approved.new_row, 'APPROVED', 'PAID', actor);
    expect(paid.ok).toBe(true);
    expect(paid.new_row.status).toBe('PAID');
    expect(paid.new_row.amount).toBe(125000);
  });

  it('permits rejecting or cancelling a corrupt row instead of paying it', () => {
    expect(transitionApproval(row(0), 'PENDING', 'REJECTED', actor).ok).toBe(true);
    expect(transitionApproval(row(-1), 'PENDING', 'CANCELLED', actor).ok).toBe(true);
  });
});
