import { describe, it, expect } from 'vitest';
import { nextApprovalStatus, normalizeApprovalStatus } from './lateness';

describe('normalizeApprovalStatus', () => {
  it('treats empty/legacy status as PENDING', () => {
    expect(normalizeApprovalStatus('')).toBe('PENDING');
    expect(normalizeApprovalStatus(undefined)).toBe('PENDING');
    expect(normalizeApprovalStatus(null)).toBe('PENDING');
  });

  it('normalizes case and whitespace', () => {
    expect(normalizeApprovalStatus(' pending ')).toBe('PENDING');
    expect(normalizeApprovalStatus('approved')).toBe('APPROVED');
  });
});

describe('nextApprovalStatus', () => {
  it('PENDING → APPROVED on APPROVE', () => {
    expect(nextApprovalStatus('PENDING', 'APPROVE')).toBe('APPROVED');
  });

  it('PENDING → REJECTED on REJECT', () => {
    expect(nextApprovalStatus('PENDING', 'REJECT')).toBe('REJECTED');
  });

  it('legacy empty status is approvable', () => {
    expect(nextApprovalStatus('', 'APPROVE')).toBe('APPROVED');
  });

  it('rejects double-decision (already APPROVED/REJECTED)', () => {
    expect(() => nextApprovalStatus('APPROVED', 'APPROVE')).toThrow('already decided');
    expect(() => nextApprovalStatus('REJECTED', 'REJECT')).toThrow('already decided');
  });

  it('rejects unknown decisions', () => {
    expect(() => nextApprovalStatus('PENDING', 'MAYBE' as never)).toThrow('Unknown decision');
  });
});
