import { describe, it, expect } from 'vitest';
import {
  FraudControlError,
  assertNotSelfApproval,
  assertReceivingVerification,
  assertReason,
  varianceSeverity,
  variancePct,
  checkReceivingThreeWay,
  VARIANCE_WARN_PCT,
  VARIANCE_CRIT_PCT
} from '../src/lib/fraud-controls';
import { computeChainHash } from '../src/lib/audit';

describe('assertNotSelfApproval', () => {
  it('allows different approver', () => {
    expect(() => assertNotSelfApproval('USR-001', 'USR-002')).not.toThrow();
  });
  it('blocks same user (case-insensitive)', () => {
    expect(() => assertNotSelfApproval('USR-001', 'usr-001')).toThrow(FraudControlError);
    try {
      assertNotSelfApproval('USR-001', 'USR-001');
    } catch (e) {
      expect((e as FraudControlError).code).toBe('SELF_APPROVAL');
    }
  });
  it('allows empty requestedBy (legacy rows)', () => {
    expect(() => assertNotSelfApproval('', 'USR-001')).not.toThrow();
  });
});

describe('assertReceivingVerification', () => {
  it('requires verifier', () => {
    expect(() => assertReceivingVerification('USR-001', '')).toThrow(FraudControlError);
    expect(() => assertReceivingVerification('USR-001', undefined)).toThrow(FraudControlError);
  });
  it('blocks verifier = receiver', () => {
    try {
      assertReceivingVerification('USR-001', 'USR-001');
      expect.unreachable();
    } catch (e) {
      expect((e as FraudControlError).code).toBe('SELF_VERIFICATION');
    }
  });
  it('allows distinct verifier', () => {
    expect(() => assertReceivingVerification('USR-001', 'USR-002')).not.toThrow();
  });
});

describe('assertReason', () => {
  it('rejects short/empty reasons', () => {
    expect(() => assertReason('')).toThrow(FraudControlError);
    expect(() => assertReason('abc')).toThrow(FraudControlError);
    expect(() => assertReason(undefined)).toThrow(FraudControlError);
  });
  it('accepts real reason', () => {
    expect(() => assertReason('Barang rusak saat pengiriman')).not.toThrow();
  });
});

describe('varianceSeverity / variancePct (owner thresholds)', () => {
  it('OK at or below 2%', () => {
    expect(varianceSeverity(0)).toBe('OK');
    expect(varianceSeverity(1.9)).toBe('OK');
    expect(varianceSeverity(-2)).toBe('OK');
  });
  it('HIGH above 2% up to 5%', () => {
    expect(varianceSeverity(2.1)).toBe('HIGH');
    expect(varianceSeverity(-4.9)).toBe('HIGH');
  });
  it('CRITICAL above 5%', () => {
    expect(varianceSeverity(5.1)).toBe('CRITICAL');
    expect(varianceSeverity(-10)).toBe('CRITICAL');
  });
  it('thresholds match owner SOP', () => {
    expect(VARIANCE_WARN_PCT).toBe(2);
    expect(VARIANCE_CRIT_PCT).toBe(5);
  });
  it('variancePct handles zero base', () => {
    expect(variancePct(0, 0)).toBe(0);
    expect(variancePct(5, 0)).toBe(100);
    expect(variancePct(95, 100)).toBe(-5);
  });
});

describe('checkReceivingThreeWay', () => {
  it('OK when accepted ≈ ordered', () => {
    const r = checkReceivingThreeWay(100, 99);
    expect(r.severity).toBe('OK');
    expect(r.messages).toHaveLength(0);
  });
  it('HIGH when accepted 3% under ordered', () => {
    const r = checkReceivingThreeWay(100, 97);
    expect(r.severity).toBe('HIGH');
    expect(r.messages[0]).toContain('97');
  });
  it('CRITICAL when accepted 10% under ordered', () => {
    const r = checkReceivingThreeWay(100, 90);
    expect(r.severity).toBe('CRITICAL');
  });
  it('scale weight disagreement escalates severity', () => {
    const r = checkReceivingThreeWay(100, 100, 90); // invoice matches PO, scale says 90
    expect(r.severity).toBe('CRITICAL');
    expect(r.pctVsScale).toBe(-10);
  });
  it('scale weight confirming accepted keeps OK', () => {
    const r = checkReceivingThreeWay(100, 99, 99);
    expect(r.severity).toBe('OK');
  });
});

describe('computeChainHash (audit tamper-evidence)', () => {
  const row = {
    audit_id: 'AUD-1', module: 'warehouse', action: 'create',
    record_type: 'adjustment', record_id: 'ADJ-1',
    before_value: '', after_value: '{}', reason: 'test',
    user_id: 'USR-001', approval_user_id: '', environment: 'TESTING',
    ip_address: '', created_at: '2026-07-18 10:00:00'
  };

  it('is deterministic', () => {
    expect(computeChainHash('GENESIS', row)).toBe(computeChainHash('GENESIS', row));
  });
  it('changes when any field changes', () => {
    const h1 = computeChainHash('GENESIS', row);
    const h2 = computeChainHash('GENESIS', { ...row, after_value: '{"tampered":true}' });
    expect(h1).not.toBe(h2);
  });
  it('changes when previous hash changes (chain property)', () => {
    const h1 = computeChainHash('GENESIS', row);
    const h2 = computeChainHash('abc123', row);
    expect(h1).not.toBe(h2);
  });
  it('produces 64-char hex sha256', () => {
    expect(computeChainHash('GENESIS', row)).toMatch(/^[0-9a-f]{64}$/);
  });
});
