import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks for the real audit writer contract ─────────────────────────────
// audit.ts imports { appendRows, TABS } from '@/db/sheets',
// nowTimestampWib from ./format, and auditId from ./id-gen.
// We keep the real TABS / TAB_HEADERS (schema conformance is asserted
// against them) and only stub the I/O boundary (appendRows) plus the
// nondeterministic fns (clock, id) for exact-row assertions.
vi.mock('@/db/sheets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/sheets')>();
  return {
    ...actual,
    appendRows: vi.fn(async () => 1),
  };
});

vi.mock('../src/lib/format', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/format')>();
  return {
    ...actual,
    nowTimestampWib: vi.fn(() => '2026-01-01 00:00:00'),
  };
});

vi.mock('../src/lib/id-gen', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/id-gen')>();
  return {
    ...actual,
    auditId: vi.fn(() => 'AUD-FIXED-001'),
  };
});

import { logAudit } from '../src/lib/audit';
import { appendRows, TABS, TAB_HEADERS } from '@/db/sheets';
import { toCsv, csvEscape } from '../src/lib/csv';

const mockAppendRows = vi.mocked(appendRows);

describe('logAudit writer contract (audit.ts × audit_log schema)', () => {
  const savedEnv = process.env.ENVIRONMENT;

  beforeEach(() => {
    mockAppendRows.mockClear();
    mockAppendRows.mockResolvedValue(1);
    delete process.env.ENVIRONMENT;
  });

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.ENVIRONMENT;
    else process.env.ENVIRONMENT = savedEnv;
  });

  it('appends exactly one row to the audit_log tab with the full 13-column schema', async () => {
    await logAudit({
      module: 'finance',
      action: 'create',
      recordType: 'expense',
      recordId: 'EXP-1',
      beforeValue: '',
      afterValue: '{"amount":1000}',
      reason: 'unit test',
      userId: 'U1',
    });

    expect(mockAppendRows).toHaveBeenCalledTimes(1);
    const [tab, rows] = mockAppendRows.mock.calls[0];
    expect(tab).toBe(TABS.auditLog);
    expect(rows).toHaveLength(1);

    // Exact row: mocked id + clock, '' defaults, TESTING env fallback.
    expect(rows[0]).toEqual({
      audit_id: 'AUD-FIXED-001',
      module: 'finance',
      action: 'create',
      record_type: 'expense',
      record_id: 'EXP-1',
      before_value: '',
      after_value: '{"amount":1000}',
      reason: 'unit test',
      user_id: 'U1',
      approval_user_id: '',
      environment: 'TESTING',
      ip_address: '',
      created_at: '2026-01-01 00:00:00',
    });

    // Row keys conform exactly to the audit_log header (no more, no less —
    // notably no chain_hash: Finance has no hash-chain column by design).
    expect(Object.keys(rows[0]).sort()).toEqual(
      [...TAB_HEADERS[TABS.auditLog]].sort(),
    );
    expect(rows[0]).not.toHaveProperty('chain_hash');
  });

  it('preserves before/after/actor/reason context (Revisi #27 sensitive-field audit)', async () => {
    await logAudit({
      module: 'finance',
      action: 'approve',
      recordType: 'supplier_payment',
      recordId: 'PAY-9',
      beforeValue: '{"status":"PENDING","amount":500000}',
      afterValue: '{"status":"APPROVED","amount":500000}',
      reason: 'invoice INV-2026-009 verified',
      userId: 'FIN-APPROVER-1',
      approvalUserId: 'FIN-APPROVER-1',
      environment: 'PRODUCTION',
      ipAddress: '10.0.0.7',
    });

    const row = mockAppendRows.mock.calls[0][1][0];
    expect(row.before_value).toBe('{"status":"PENDING","amount":500000}');
    expect(row.after_value).toBe('{"status":"APPROVED","amount":500000}');
    expect(row.user_id).toBe('FIN-APPROVER-1');
    expect(row.approval_user_id).toBe('FIN-APPROVER-1');
    expect(row.reason).toBe('invoice INV-2026-009 verified');
    expect(row.environment).toBe('PRODUCTION');
    expect(row.ip_address).toBe('10.0.0.7');
  });

  it('falls back to process.env.ENVIRONMENT when the entry omits environment', async () => {
    process.env.ENVIRONMENT = 'STAGING-X';
    await logAudit({
      module: 'finance',
      action: 'create',
      recordType: 'petty_cash',
      recordId: 'PC-3',
      userId: 'U2',
    });

    expect(mockAppendRows.mock.calls[0][1][0].environment).toBe('STAGING-X');
  });

  it('contains storage failures: resolves instead of rejecting and logs via console.error', async () => {
    const err = new Error('sheets down');
    mockAppendRows.mockRejectedValueOnce(err);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // The writer swallows append errors by design (audit.ts try/catch) so a
    // logging failure never breaks the calling mutation.
    await expect(
      logAudit({
        module: 'finance',
        action: 'delete',
        recordType: 'expense',
        recordId: 'EXP-9',
        userId: 'U1',
      }),
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledWith(
      '[audit] failed to write audit log:',
      err,
    );
    errSpy.mockRestore();
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
