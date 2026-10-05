import { describe, it, expect, beforeAll, vi } from 'vitest';
import { POST } from './route';
import { findRow, TABS } from '@/db/sheets';

// In-memory mock DB; audit stays best-effort.
beforeAll(() => {
  process.env.USE_MOCK_DB = 'true';
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.YKP_HR_SPREADSHEET_ID;
  delete process.env.FINANCE_NOTIFY_SECRET;
  delete process.env.HR_NOTIFY_SECRET;
});

let sessionMock: (() => Promise<unknown>) | null = null;
vi.mock('@/lib/session', () => ({
  getSession: () => (sessionMock ? sessionMock() : Promise.resolve(null))
}));
vi.mock('@/lib/audit', () => ({ logAudit: () => Promise.resolve() }));

function asRole(role: string, userId = 'USR-001'): void {
  sessionMock = () => Promise.resolve({ userId, role, employeeId: 'EMP-001' });
}

function req(body: unknown): Request {
  return new Request('http://localhost/api/hr/payroll/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

const ctx = { params: Promise.resolve({}) };
const OLD_TS = '2026-10-03 09:00:00';

async function seedRow(payrollId: string, status: Record<string, string>): Promise<void> {
  const { appendRows, TABS } = await import('@/db/sheets');
  await appendRows(TABS.payroll, [{
    payroll_id: payrollId,
    payroll_period: '2025-06',
    employee_id: 'EMP-001',
    employee_name: 'Seed One',
    updated_at: OLD_TS,
    created_at: OLD_TS,
    ...status
  }]);
}

describe('POST /api/hr/payroll/approve', () => {
  it('no-op idempotent for auto-approved locked rows (200, unchanged, no write)', async () => {
    asRole('owner');
    await seedRow('PR-IDEM-001', {
      approval_status: 'APPROVED',
      payment_status: 'READY_TO_PAY',
      locked_status: 'LOCKED',
      approved_by: 'USR-HR'
    });
    const res = await POST(req({ payroll_id: 'PR-IDEM-001', decision: 'APPROVE' }), ctx);
    expect(res.status).toBe(200);
    const stored = await findRow(TABS.payroll, 'payroll_id', 'PR-IDEM-001');
    expect(stored?.row.approval_status).toBe('APPROVED');
    expect(stored?.row.locked_status).toBe('LOCKED');
    expect(stored?.row.approved_by).toBe('USR-HR'); // still the generator
    expect(stored?.row.updated_at).toBe(OLD_TS); // untouched
  });

  it('no-op idempotent for APPROVED-unlocked rows', async () => {
    asRole('owner');
    await seedRow('PR-IDEM-002', { approval_status: 'APPROVED', payment_status: 'READY_TO_PAY', locked_status: '' });
    const res = await POST(req({ payroll_id: 'PR-IDEM-002', decision: 'APPROVE' }), ctx);
    expect(res.status).toBe(200);
    const stored = await findRow(TABS.payroll, 'payroll_id', 'PR-IDEM-002');
    expect(stored?.row.locked_status).toBe(''); // not suddenly re-locked
    expect(stored?.row.updated_at).toBe(OLD_TS);
  });

  it('legacy transition kept: PENDING row approves to APPROVED + READY_TO_PAY + LOCKED', async () => {
    asRole('owner');
    await seedRow('PR-IDEM-003', { approval_status: 'PENDING', payment_status: 'UNPAID', locked_status: '' });
    const res = await POST(req({ payroll_id: 'PR-IDEM-003', decision: 'APPROVE' }), ctx);
    expect(res.status).toBe(200);
    const stored = await findRow(TABS.payroll, 'payroll_id', 'PR-IDEM-003');
    expect(stored?.row.approval_status).toBe('APPROVED');
    expect(stored?.row.payment_status).toBe('READY_TO_PAY');
    expect(stored?.row.locked_status).toBe('LOCKED');
    expect(stored?.row.approved_by).toBe('USR-001');
  });

  it('REJECT on an APPROVED row still conflicts 409 (idempotence guards APPROVE only)', async () => {
    asRole('owner');
    await seedRow('PR-IDEM-004', { approval_status: 'APPROVED', payment_status: 'READY_TO_PAY', locked_status: 'LOCKED' });
    const res = await POST(req({ payroll_id: 'PR-IDEM-004', decision: 'REJECT' }), ctx);
    expect(res.status).toBe(409);
  });

  it('rejects roles without approve grant (hr_admin generates, cannot approve) with 403', async () => {
    asRole('hr_admin');
    await seedRow('PR-IDEM-005', { approval_status: 'PENDING', payment_status: 'UNPAID', locked_status: '' });
    const res = await POST(req({ payroll_id: 'PR-IDEM-005', decision: 'APPROVE' }), ctx);
    expect(res.status).toBe(403);
  });

  it('404 for unknown payroll_id', async () => {
    asRole('owner');
    const res = await POST(req({ payroll_id: 'PR-DOES-NOT-EXIST', decision: 'APPROVE' }), ctx);
    expect(res.status).toBe(404);
  });
});