import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../../middleware';
import { POST } from '@/app/api/hr/payroll/needs-revision/route';
import { appendRows, findRow, TABS } from '@/db/sheets';

const SERVICE_SECRET = 'integration-finance-fixture-at-least-32-characters';
const SESSION_SECRET = 'integration-session-fixture-at-least-32-characters';
const session = vi.hoisted(() => ({ role: null as string | null }));
vi.mock('@/lib/session', () => ({
  getSession: async () => session.role ? { userId: 'USR-MIDDLEWARE', role: session.role } : null
}));
vi.mock('@/lib/audit', () => ({ logAudit: async () => undefined }));

let sequence = 0;

/** Issue a synthetic signed cookie for the real middleware verifier. */
function cookie(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'USR-MIDDLEWARE', role: session.role, exp: 4102444800 })).toString('base64url');
  const signature = createHmac('sha256', SESSION_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `ykp_hr_session=${header}.${payload}.${signature}`;
}

/** Seed the actual in-memory adapter with an isolated ready-to-pay record. */
async function seedPayroll(): Promise<string> {
  const id = `PR-MIDDLEWARE-${++sequence}`;
  await appendRows(TABS.payroll, [{
    payroll_id: id, employee_id: 'EMP-MIDDLEWARE', payroll_period: '2026-09',
    approval_status: 'APPROVED', payment_status: 'READY_TO_PAY', locked_status: '',
    created_at: '2026-09-01 00:00:00', updated_at: '2026-09-01 00:00:00'
  }]);
  return id;
}

/** Follow the actual middleware decision before invoking the actual route. */
async function requestRevision(id: string, headers: Record<string, string>): Promise<Response> {
  const request = new NextRequest('http://localhost/api/hr/payroll/needs-revision', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ payroll_id: id, reason: 'Correct the overtime allowance' })
  });
  const decision = await middleware(request);
  if (decision.headers.get('x-middleware-next') !== '1') return decision;
  return POST(request, { params: Promise.resolve({}) });
}

beforeEach(() => {
  vi.stubEnv('USE_MOCK_DB', 'true');
  vi.stubEnv('FINANCE_NOTIFY_SECRET', SERVICE_SECRET);
  vi.stubEnv('HR_NOTIFY_SECRET', '');
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET);
  session.role = null;
});
afterEach(() => vi.unstubAllEnvs());

describe('payroll revision middleware-to-handler contract', () => {
  it('accepts the finance service without a cookie and persists its revision', async () => {
    const id = await seedPayroll();
    const response = await requestRevision(id, { 'x-finance-secret': SERVICE_SECRET });
    expect(response.status).toBe(200);
    const stored = await findRow(TABS.payroll, 'payroll_id', id);
    expect(stored?.row.approval_status).toBe('NEEDS_REVISION');
    expect(stored?.row.needs_revision_by).toBe('finance-app');
  });

  it('honors the HR_NOTIFY_SECRET alias already supported by the route', async () => {
    delete process.env.FINANCE_NOTIFY_SECRET;
    vi.stubEnv('HR_NOTIFY_SECRET', SERVICE_SECRET);
    const response = await requestRevision(await seedPayroll(), { 'x-finance-secret': SERVICE_SECRET });
    expect(response.status).toBe(200);
  });

  it.each([{}, { 'x-finance-secret': 'invalid' }])('rejects unauthenticated service headers %j', async (headers) => {
    const id = await seedPayroll();
    expect((await requestRevision(id, headers as Record<string, string>)).status).toBe(401);
    expect((await findRow(TABS.payroll, 'payroll_id', id))?.row.approval_status).toBe('APPROVED');
  });

  it('does not accept an undersized configured secret', async () => {
    vi.stubEnv('FINANCE_NOTIFY_SECRET', 'short-fixture');
    expect((await requestRevision(await seedPayroll(), { 'x-finance-secret': 'short-fixture' })).status).toBe(401);
  });

  it('keeps valid HR-session access when no service secret is sent', async () => {
    session.role = 'owner';
    const response = await requestRevision(await seedPayroll(), { cookie: cookie() });
    expect(response.status).toBe(200);
    expect((await response.json()).data.needs_revision_by).toBe('USR-MIDDLEWARE');
  });

  it('retains route RBAC for an employee with a valid session', async () => {
    session.role = 'employee';
    expect((await requestRevision(await seedPayroll(), { cookie: cookie() })).status).toBe(403);
  });

  it.each([
    { path: '/api/hr/payroll/needs-revision', method: 'GET' },
    { path: '/api/hr/employees', method: 'POST' }
  ])('does not extend service bypass to $method $path', async ({ path, method }) => {
    const response = await middleware(new NextRequest(`http://localhost${path}`, {
      method, headers: { 'x-finance-secret': SERVICE_SECRET }
    }));
    expect(response.status).toBe(401);
  });

  it('preserves finance-notify service-only authentication', async () => {
    const valid = await middleware(new NextRequest('http://localhost/api/hr/payroll/finance-notify', {
      method: 'POST', headers: { 'x-finance-secret': SERVICE_SECRET }
    }));
    expect(valid.headers.get('x-middleware-next')).toBe('1');
    session.role = 'owner';
    const invalid = await middleware(new NextRequest('http://localhost/api/hr/payroll/finance-notify', {
      method: 'POST', headers: { cookie: cookie(), 'x-finance-secret': 'wrong' }
    }));
    expect(invalid.status).toBe(401);
  });
});
