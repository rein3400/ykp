import { describe, it, expect } from 'vitest';
import { computeChainHash } from '../src/lib/audit';
import { toCsv, csvEscape } from '../src/lib/csv';

describe('audit hash chain', () => {
  it('produces a deterministic hash for a row', () => {
    const row = { audit_id: 'AUD-1', module: 'finance', action: 'create', record_type: 'expense', record_id: 'EXP-1', before_value: '', after_value: '{}', reason: '', user_id: 'U1', approval_user_id: '', environment: 'TESTING', ip_address: '', created_at: '2026-01-01 00:00:00' };
    const h1 = computeChainHash('GENESIS', row);
    const h2 = computeChainHash('GENESIS', row);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when a field changes (tamper detection)', () => {
    const row = { audit_id: 'AUD-1', module: 'finance', action: 'create', record_type: 'expense', record_id: 'EXP-1', before_value: '', after_value: '{}', reason: '', user_id: 'U1', approval_user_id: '', environment: 'TESTING', ip_address: '', created_at: '2026-01-01 00:00:00' };
    const h1 = computeChainHash('GENESIS', row);
    const tampered = { ...row, after_value: '{"amount":999999}' };
    const h2 = computeChainHash('GENESIS', tampered);
    expect(h1).not.toBe(h2);
  });

  it('chains: hash depends on previous hash', () => {
    const row1 = { audit_id: 'AUD-1', module: 'finance', action: 'create', record_type: 'expense', record_id: 'EXP-1', before_value: '', after_value: '{}', reason: '', user_id: 'U1', approval_user_id: '', environment: 'TESTING', ip_address: '', created_at: '2026-01-01 00:00:00' };
    const row2 = { audit_id: 'AUD-2', module: 'finance', action: 'approve', record_type: 'expense', record_id: 'EXP-1', before_value: '{}', after_value: '{"status":"APPROVED"}', reason: '', user_id: 'U2', approval_user_id: 'U2', environment: 'TESTING', ip_address: '', created_at: '2026-01-01 00:01:00' };
    const h1 = computeChainHash('GENESIS', row1);
    const h2 = computeChainHash(h1, row2);
    const h2Wrong = computeChainHash('GENESIS', row2); // wrong prev
    expect(h2).not.toBe(h2Wrong);
  });
});

describe('csv export helpers', () => {
  it('escapes fields with commas and quotes', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it('builds CSV with BOM and CRLF', () => {
    const csv = toCsv(['date', 'amount'], [{ date: '2026-01-01', amount: 1000 }, { date: '2026-01-02', amount: 2000 }]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('date,amount');
    expect(csv).toContain('2026-01-01,1000');
    expect(csv).toContain('\r\n');
  });
});
