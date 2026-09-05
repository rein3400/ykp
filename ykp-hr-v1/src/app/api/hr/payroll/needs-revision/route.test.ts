import { describe, it, expect, beforeAll, vi } from 'vitest';
import { POST } from './route';

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

function asRole(role: string): void {
  sessionMock = () => Promise.resolve({ userId: 'USR-001', role, employeeId: 'EMP-001' });
}

function req(body: unknown, headers?: Record<string, string>): Request {
  return new Request('http://localhost/api/hr/payroll/needs-revision', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers ?? {}) },
    body: JSON.stringify(body)
  });
}

const ctx = { params: Promise.resolve({}) };

async function seedApprovedPayroll(payrollId: string): Promise<void> {
  const { appendRows, TABS } = await import('@/db/sheets');
  await appendRows(TABS.payroll, [{
    payroll_id: payrollId,
    payroll_period: '2026-09',
    employee_id: 'EMP-001',
    employee_name: 'Seed One',
    approval_status: 'APPROVED',
    payment_status: 'READY_TO_PAY',
    locked_status: '',
    created_at: '2026-09-01 00:00:00',
    updated_at: '2026-09-01 00:00:00'
  }]);
}

describe('POST /api/hr/payroll/needs-revision (MOM 1 Sep 2026)', () => {
  it('rejects missing/short reason with 400', async () => {
    asRole('owner');
    const res = await POST(req({ payroll_id: 'PR-X' }), ctx);
    expect(res.status).toBe(400);
    const short = await POST(req({ payroll_id: 'PR-X', reason: 'fix' }), ctx);
    expect(short.status).toBe(400);
  });

  it('rejects unauthenticated callers with 401', async () => {
    sessionMock = null;
    const res = await POST(req({ payroll_id: 'PR-X', reason: 'nominal salah, cek ulang' }), ctx);
    expect(res.status).toBe(401);
  });

  it('rejects roles without request_revision grant (employee) with 403', async () => {
    asRole('employee');
    const res = await POST(req({ payroll_id: 'PR-X', reason: 'nominal salah, cek ulang' }), ctx);
    expect(res.status).toBe(403);
  });

  it('owner moves APPROVED → NEEDS_REVISION with reason recorded', async () => {
    asRole('owner');
    await seedApprovedPayroll('PR-NR-001');
    const res = await POST(
      req({ payroll_id: 'PR-NR-001', reason: 'nominal lembur kelebihan 2 jam' }),
      ctx
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.approval_status).toBe('NEEDS_REVISION');
    expect(j.data.revision_reason).toBe('nominal lembur kelebihan 2 jam');
    expect(j.data.revision_by).toBe('USR-001');
  });

  it('second request on the same row conflicts with 409', async () => {
    asRole('owner');
    const res = await POST(
      req({ payroll_id: 'PR-NR-001', reason: 'masih salah, cek lagi dong' }),
      ctx
    );
    expect(res.status).toBe(409);
  });

  it('cross-app finance secret works without HR session', async () => {
    process.env.FINANCE_NOTIFY_SECRET = 's3cret-finance-32chars-minimum-ok!!';
    sessionMock = null;
    await seedApprovedPayroll('PR-NR-002');
    const res = await POST(
      req(
        { payroll_id: 'PR-NR-002', reason: 'rekening karyawan berubah' },
        { 'x-finance-secret': 's3cret-finance-32chars-minimum-ok!!' }
      ),
      ctx
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.approval_status).toBe('NEEDS_REVISION');
    expect(j.data.revision_by).toBe('finance-app');
    delete process.env.FINANCE_NOTIFY_SECRET;
  });

  it('unknown payroll_id returns 404', async () => {
    asRole('finance_admin');
    const res = await POST(
      req({ payroll_id: 'PR-DOES-NOT-EXIST', reason: 'tidak ketemu datanya' }),
      ctx
    );
    expect(res.status).toBe(404);
  });
});
