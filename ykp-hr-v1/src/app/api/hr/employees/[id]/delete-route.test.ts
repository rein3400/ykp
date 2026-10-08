import { beforeAll, describe, expect, it, vi } from 'vitest';
import { appendRows, findRow, readTab, TABS } from '@/db/sheets';

beforeAll(() => {
  process.env.USE_MOCK_DB = 'true';
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.YKP_HR_SPREADSHEET_ID;
});
let role = 'hr_admin';
vi.mock('@/lib/session', () => ({ getSession: async () => ({ userId: 'USR-HR', role, outletId: '', brandId: '' }) }));
vi.mock('@/lib/audit', () => ({ logAudit: () => Promise.resolve() }));

const { DELETE } = await import('./route');
const context = { params: Promise.resolve({ id: 'EMP-DEL' }) };
const call = (id: string) => DELETE(new Request('http://localhost', { method: 'DELETE' }), { params: Promise.resolve({ id }) });

describe('DELETE employee (mistaken input)', () => {
  it('deletes an unreferenced mistaken record with before-image audit', async () => {
    role = 'hr_admin';
    await appendRows(TABS.employees, [{ employee_id: 'EMP-DEL', full_name: 'Wrong Entry', active_status: 'active' }]);
    const response = await call('EMP-DEL');
    expect(response.status).toBe(200);
    expect(await findRow(TABS.employees, 'employee_id', 'EMP-DEL')).toBeNull();
  });
  it('refuses when any operational record references the employee', async () => {
    role = 'hr_admin';
    await appendRows(TABS.employees, [{ employee_id: 'EMP-REF', full_name: 'Referenced', active_status: 'active' }]);
    await appendRows(TABS.attendance, [{ attendance_id: 'ATT-REF', employee_id: 'EMP-REF' }]);
    const response = await call('EMP-REF');
    expect(response.status).toBe(409);
    expect((await findRow(TABS.employees, 'employee_id', 'EMP-REF'))).not.toBeNull();
    expect((await readTab<Record<string, string>>(TABS.attendance)).some((row) => row.attendance_id === 'ATT-REF')).toBe(true);
  });
  it('refuses when a login account is still linked', async () => {
    role = 'hr_admin';
    await appendRows(TABS.employees, [{ employee_id: 'EMP-LINK', full_name: 'Linked', active_status: 'active' }]);
    await appendRows(TABS.users, [{ user_id: 'USR-LINK', employee_id: 'EMP-LINK', username: 'linked' }]);
    expect((await call('EMP-LINK')).status).toBe(409);
  });
  it('enforces the delete grant', async () => {
    role = 'employee';
    expect((await call('EMP-DEL')).status).toBe(403);
  });
});
