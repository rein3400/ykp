import { describe, it, expect, beforeAll, vi } from 'vitest';
import { POST } from './route';
import { appendRows, findRow, readTab, TABS } from '@/db/sheets';

// In-memory mock DB; audit stays best-effort but tracked for the single-event assertion.
beforeAll(() => {
  process.env.USE_MOCK_DB = 'true';
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.YKP_HR_SPREADSHEET_ID;
  delete process.env.FINANCE_NOTIFY_SECRET;
  delete process.env.HR_NOTIFY_SECRET;
});

const auditMock = vi.hoisted(() => vi.fn((_payload?: Record<string, unknown>) => Promise.resolve()));
vi.mock('@/lib/audit', () => ({ logAudit: auditMock }));

let sessionMock: (() => Promise<unknown>) | null = null;
vi.mock('@/lib/session', () => ({
  getSession: () => (sessionMock ? sessionMock() : Promise.resolve(null))
}));

function asRole(role: string, userId = 'USR-HR'): void {
  sessionMock = () => Promise.resolve({ userId, role, employeeId: 'EMP-001' });
}

function req(body: unknown): Request {
  return new Request('http://localhost/api/hr/payroll/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

const ctx = { params: Promise.resolve({}) };
// Fixed historical period far from dynamic mock "today" seeds (attendance/roster/payroll).
const PERIOD = '2025-06';

describe('POST /api/hr/payroll/generate (payroll-auto-approve)', () => {
  it('rejects unauthenticated callers with 401', async () => {
    sessionMock = null;
    expect((await POST(req({ period: PERIOD }), ctx)).status).toBe(401);
  });

  it('rejects roles without generate grant (employee) with 403', async () => {
    asRole('employee');
    expect((await POST(req({ period: PERIOD }), ctx)).status).toBe(403);
  });

  it('rejects invalid period with 400', async () => {
    asRole('hr_admin');
    expect((await POST(req({ period: 'Juni 2025' }), ctx)).status).toBe(400);
  });

  it('locks + auto-approves every generated row (generator = approver)', async () => {
    asRole('hr_admin', 'USR-HR');
    const res = await POST(req({ period: PERIOD }), ctx);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.count).toBeGreaterThan(0);

    const all = await readTab<Record<string, string>>(TABS.payroll);
    const periodRows = all.filter((r) => r.payroll_period === PERIOD);
    expect(periodRows.length).toBe(j.data.count);
    for (const r of periodRows) {
      expect(r.approval_status).toBe('APPROVED');
      expect(r.payment_status).toBe('READY_TO_PAY');
      expect(r.locked_status).toBe('LOCKED');
      expect(r.approved_by).toBe('USR-HR');
      expect(r.locked_by).toBe('USR-HR');
      expect(r.locked_at).not.toBe('');
      expect(r.updated_at).not.toBe('');
    }
    const spot = await findRow(TABS.payroll, 'payroll_id', `PR-EMP-001-${PERIOD}`);
    expect(spot).not.toBeNull();
  });

  it('emits a single combined generate audit event (no separate approve)', async () => {
    expect(auditMock).toHaveBeenCalledTimes(1);
    const call = auditMock.mock.calls[0]?.[0] as { action: string; entity: string; afterValue: string } | undefined;
    if (!call) throw new Error('generate audit event missing');
    expect(call.action).toBe('generate');
    expect(call.entity).toBe('payroll');
    expect(call.afterValue).toContain('auto-approve');
    expect(call.afterValue).toContain('USR-HR');
  });

  it('conflicts 409 when the period already holds locked rows (re-generate blocked)', async () => {
    asRole('hr_admin');
    const res = await POST(req({ period: PERIOD }), ctx);
    expect(res.status).toBe(409);
    const j = await res.json();
    expect(j.error.code).toBe('conflict');
  });

  it('does not merge foreign-period rows into the generated set', async () => {
    asRole('hr_admin');
    await appendRows(TABS.payroll, [{
      payroll_id: `PR-SEED-OTHER-${PERIOD.replace('-', '')}`,
      payroll_period: '2019-12',
      employee_id: 'EMP-001',
      employee_name: 'Seed Other',
      approval_status: 'PENDING',
      payment_status: 'UNPAID',
      locked_status: '',
      created_at: '2019-12-01 00:00:00',
      updated_at: '2019-12-01 00:00:00'
    }]);
    const all = await readTab<Record<string, string>>(TABS.payroll);
    expect(all.filter((r) => r.payroll_period === PERIOD).every((r) => r.approval_status === 'APPROVED')).toBe(true);
    expect(all.find((r) => r.payroll_id === `PR-SEED-OTHER-${PERIOD.replace('-', '')}`)?.approval_status).toBe('PENDING');
  });
});