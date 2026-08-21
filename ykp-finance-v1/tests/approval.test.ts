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

  it('rejects self-approve: actor who created the row cannot APPROVE it', () => {
    const r = transitionApproval(
      row({ createdBy: 'USR-001' }),
      'PENDING', 'APPROVED',
      { id: 'USR-001', role: 'owner' }
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain('segregation of duties');
  });

  it('rejects self-approve even when role would otherwise allow the amount', () => {
    // owner can approve any amount, but still cannot self-approve
    const r = transitionApproval(
      row({ amount: 5_000_000, createdBy: 'USR-009' }),
      'PENDING', 'APPROVED',
      { id: 'USR-009', role: 'owner' }
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain('segregation of duties');
  });

  it('rejects self-approve on APPROVED → PAID (supplier payment by creator)', () => {
    const r = transitionApproval(
      row({ entity: 'supplier_cost', status: 'APPROVED', amount: 1500000, createdBy: 'USR-001' }),
      'APPROVED', 'PAID',
      { id: 'USR-001', role: 'owner' }
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain('segregation of duties');
  });

  it('a DIFFERENT approver with sufficient role still succeeds', () => {
    const r = transitionApproval(
      row({ createdBy: 'USR-001' }),
      'PENDING', 'APPROVED',
      { id: 'USR-002', role: 'finance_admin' }
    );
    expect(r.ok).toBe(true);
    expect(r.new_row.approvedBy).toBe('USR-002');
  });

  it('REJECT by the creator is allowed (not a self-approval)', () => {
    const r = transitionApproval(
      row({ createdBy: 'USR-001' }),
      'PENDING', 'REJECTED',
      { id: 'USR-001', role: 'finance_admin' }
    );
    expect(r.ok).toBe(true);
  });

  it('self-approve does not fire when createdBy is absent (legacy rows)', () => {
    const r = transitionApproval(
      row({ createdBy: undefined }),
      'PENDING', 'APPROVED',
      { id: 'USR-001', role: 'finance_admin' }
    );
    expect(r.ok).toBe(true);
  });
});
