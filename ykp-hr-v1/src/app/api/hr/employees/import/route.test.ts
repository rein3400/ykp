import { describe, it, expect, beforeAll, vi } from 'vitest';
import { POST } from './route';

// In-memory mock DB so appendRows resolves against the seeded employees tab.
beforeAll(() => {
  process.env.USE_MOCK_DB = 'true';
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.YKP_HR_SPREADSHEET_ID;
});

// Mock session so the owner-role create guard passes; audit stays best-effort.
let sessionMock: (() => Promise<unknown>) | null = null;
vi.mock('@/lib/session', () => ({
  getSession: () => (sessionMock ? sessionMock() : Promise.resolve(null))
}));
vi.mock('@/lib/audit', () => ({ logAudit: () => Promise.resolve() }));

function asOwner(): void {
  sessionMock = () =>
    Promise.resolve({ userId: 'USR-001', role: 'owner', employeeId: 'EMP-001' });
}

function csvRequest(rows: string): Request {
  const form = new FormData();
  form.append('file', new File([rows], 'emp.csv', { type: 'text/csv' }));
  return new Request('http://localhost/api/hr/employees/import', {
    method: 'POST',
    body: form
  });
}

const ctx = { params: Promise.resolve({}) };

function readEmployees(): Promise<Record<string, string>[]> {
  return import('@/db/sheets').then(({ readTab, TABS }) =>
    readTab<Record<string, string>>(TABS.employees)
  );
}

describe('POST /api/hr/employees/import (bugs #1, #2, #5)', () => {
  it('parses Rp-formatted basic_salary into integer IDR (bug #1)', async () => {
    asOwner();
    const before = await readEmployees();
    const res = await POST(
      csvRequest(
        'full_name,outlet_id,basic_salary\n' +
          'Imported One,OL-001,Rp 1.500.000\n' +
          'Imported Two,OL-001,2.500.000\n'
      ),
      ctx
    );
    expect(res.status).toBe(200);
    const after = await readEmployees();
    const added = after.slice(before.length);
    expect(added).toHaveLength(2);
    expect(added[0].basic_salary).toBe('1500000');
    expect(added[1].basic_salary).toBe('2500000');
    expect(added[0].basic_salary).not.toBe('NaN');
  });

  it('defaults join_date to a WIB date, not UTC (bug #2)', async () => {
    asOwner();
    const before = await readEmployees();
    await POST(
      csvRequest('full_name,outlet_id,basic_salary\nNo Join Date,OL-001,1000000\n'),
      ctx
    );
    const after = await readEmployees();
    const added = after[before.length];
    // join_date must be a YYYY-MM-DD string; assert it parses and matches today WIB.
    expect(added.join_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const { todayWib } = await import('@/lib/format');
    expect(added.join_date).toBe(todayWib());
  });

  it('generates race-free unique employee ids via nextSequentialIdSync (bug #5)', async () => {
    asOwner();
    const before = await readEmployees();
    // Fire two imports "concurrently" — pre-fix this could collide on EMP-NNN.
    await Promise.all([
      POST(csvRequest('full_name,outlet_id,basic_salary\nConcurrent A,OL-001,1000000\n'), ctx),
      POST(csvRequest('full_name,outlet_id,basic_salary\nConcurrent B,OL-001,1000000\n'), ctx)
    ]);
    const after = await readEmployees();
    const added = after.slice(before.length);
    expect(added).toHaveLength(2);
    expect(added[0].employee_id).not.toBe(added[1].employee_id);
    expect(added[0].employee_id).toMatch(/^EMP-/);
    expect(added[1].employee_id).toMatch(/^EMP-/);
  });
});