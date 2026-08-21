import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { POST } from './route';

// In-memory mock DB (USE_MOCK_DB) so findRow resolves against the seeded
// attendance rows without Google credentials. ATT-001 belongs to EMP-001,
// ATT-005 belongs to EMP-006.
beforeAll(() => {
  process.env.USE_MOCK_DB = 'true';
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.YKP_HR_SPREADSHEET_ID;
});

// Mock session per-test so we can assert the self-only RBAC guard introduced
// in the bug-3 fix. getSession is async (reads next/headers cookies) so we
// stub it with a resolvable value.
let sessionMock: (() => Promise<unknown>) | null = null;
vi.mock('@/lib/session', () => ({
  getSession: () => (sessionMock ? sessionMock() : Promise.resolve(null))
}));

// Audit writes to the mock store; keep it best-effort and silent.
vi.mock('@/lib/audit', () => ({ logAudit: () => Promise.resolve() }));

function withSession(s: Record<string, unknown>): void {
  sessionMock = () => Promise.resolve(s);
}

function postBody(attendanceId: string): Request {
  return new Request('http://localhost/api/hr/attendance/correction', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      attendance_id: attendanceId,
      correction_type: 'CLOCK_IN',
      corrected_clock_in: '07:00',
      reason: 'Lupa tap'
    })
  });
}

const ctx = { params: Promise.resolve({}) };

describe('POST /api/hr/attendance/correction RBAC (bug #3)', () => {
  beforeEach(() => {
    sessionMock = null;
  });

  it('forbids an employee from correcting another employee attendance', async () => {
    // EMP-002 (Sari) attempts to correct ATT-001, which belongs to EMP-001.
    withSession({
      userId: 'USR-TEST',
      role: 'employee',
      employeeId: 'EMP-002'
    });
    const res = await POST(postBody('ATT-001'), ctx);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain('sendiri');
  });

  it('allows an employee to correct their own attendance', async () => {
    // EMP-001 owns ATT-001.
    withSession({
      userId: 'USR-001',
      role: 'employee',
      employeeId: 'EMP-001'
    });
    const res = await POST(postBody('ATT-001'), ctx);
    expect(res.status).toBe(201);
  });

  it('allows an hr_admin to correct any employee attendance', async () => {
    // hr_admin has update on attendance → isManager branch bypasses self-check.
    withSession({
      userId: 'USR-002',
      role: 'hr_admin',
      employeeId: 'EMP-012'
    });
    const res = await POST(postBody('ATT-005'), ctx);
    expect(res.status).toBe(201);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await POST(postBody('ATT-001'), ctx);
    expect(res.status).toBe(401);
  });
});