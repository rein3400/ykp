import { describe, it, expect } from 'vitest';
import {
  transitionApproval, isTransitionAllowed, canApproveAmount,
  type ApprovalRow
} from '../src/lib/approval';

function row(over: Partial<ApprovalRow> = {}): ApprovalRow {
  return {
    id: 'EXP-1',
    entity: 'expense',
    amount: 300000,
    status: 'PENDING',
    approvedBy: null,
    ...over
  };
}

describe('approval FSM (ported from engine, keeps CANCELLED fix)', () => {
  it('allows the documented transitions', () => {
    expect(isTransitionAllowed('DRAFT', 'PENDING')).toBe(true);
    expect(isTransitionAllowed('DRAFT', 'CANCELLED')).toBe(true);
    expect(isTransitionAllowed('PENDING', 'APPROVED')).toBe(true);
    expect(isTransitionAllowed('PENDING', 'REJECTED')).toBe(true);
    expect(isTransitionAllowed('PENDING', 'CANCELLED')).toBe(true);
    expect(isTransitionAllowed('APPROVED', 'PAID')).toBe(true);
    expect(isTransitionAllowed('APPROVED', 'CANCELLED')).toBe(true);
  });

  it('rejects terminal-state and backwards transitions', () => {
    expect(isTransitionAllowed('PAID', 'APPROVED')).toBe(false);
    expect(isTransitionAllowed('REJECTED', 'PENDING')).toBe(false);
    expect(isTransitionAllowed('CANCELLED', 'PENDING')).toBe(false);
    expect(isTransitionAllowed('APPROVED', 'DRAFT')).toBe(false);
  });

  it('PENDING → APPROVED by finance_admin records approvedBy', () => {
    const r = transitionApproval(row(), 'PENDING', 'APPROVED', { id: 'USR-002', role: 'finance_admin' });
    expect(r.ok).toBe(true);
    expect(r.new_row.status).toBe('APPROVED');
    expect(r.new_row.approvedBy).toBe('USR-002');
    expect(r.audit_action).toBe('approval:PENDING->APPROVED');
  });

  it('denies when the role amount threshold is exceeded', () => {
    // outlet_manager max 500k for expense
    const big = row({ amount: 5_000_000 });
    const r = transitionApproval(big, 'PENDING', 'APPROVED', { id: 'USR-9', role: 'outlet_manager' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('cannot approve amount');
    expect(r.audit_action).toContain('approval-denied');
  });

  it('enforces per-entity tiers (supplier_cost requires finance_admin+)', () => {
    expect(canApproveAmount('supplier_cost', 100000, 'outlet_manager')).toBe(false);
    expect(canApproveAmount('supplier_cost', 100000, 'finance_admin')).toBe(true);
    expect(canApproveAmount('petty_cash', 400000, 'outlet_manager')).toBe(true);
    expect(canApproveAmount('petty_cash', 20_000_000, 'finance_admin')).toBe(false);
    expect(canApproveAmount('petty_cash', 20_000_000, 'owner')).toBe(true);
  });

  it('rejects mismatched from_status and illegal jumps', () => {
    const r1 = transitionApproval(row({ status: 'DRAFT' }), 'PENDING', 'APPROVED', { id: 'U', role: 'owner' });
    expect(r1.ok).toBe(false);
    expect(r1.error).toContain('does not match');
    const r2 = transitionApproval(row(), 'PENDING', 'PAID', { id: 'U', role: 'owner' });
    expect(r2.ok).toBe(false);
    expect(r2.error).toContain('not allowed');
  });

  it('APPROVED → PAID transition used by supplier payment flow', () => {
    const r = transitionApproval(
      row({ entity: 'supplier_cost', status: 'APPROVED', amount: 1500000 }),
      'APPROVED', 'PAID',
      { id: 'USR-001', role: 'owner' }
    );
    expect(r.ok).toBe(true);
    expect(r.new_row.status).toBe('PAID');
  });

  it('rejects approval of zero or negative amounts', () => {
    const zero = transitionApproval(row({ amount: 0 }), 'PENDING', 'APPROVED', { id: 'U', role: 'owner' });
    expect(zero.ok).toBe(false);
    expect(zero.error).toContain('amount must be > 0');
    const neg = transitionApproval(row({ amount: -5000 }), 'PENDING', 'APPROVED', { id: 'U', role: 'owner' });
    expect(neg.ok).toBe(false);
    expect(neg.error).toContain('amount must be > 0');
  });
});
