import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
const lookup = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/db/sheets', async (original) => ({
  ...await original<typeof import('@/db/sheets')>(),
  readTab: async (tab: string) => tab === 'users' ? [{ telegram_id: '123456789', employee_id: 'E1', active_status: 'active' }] : [{ attendance_id: 'A1', date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), employee_id: 'E1', outlet_id: 'VISITED' }],
  findRow: lookup, updateRow: update
}));
afterEach(() => vi.unstubAllEnvs());
describe('roaming checkout location', () => {
  it('checks the clock-in outlet instead of current employee home', async () => {
    vi.stubEnv('TELEGRAM_BOT_SECRET', 'test-only');
    lookup.mockImplementation(async (tab: string, _key: string, value: string) => {
      if (tab === 'hr_attendance') return { rowNumber: 2, row: { attendance_id: 'A1', outlet_id: 'VISITED', scheduled_check_in: '08:00', scheduled_check_out: '17:00' } };
      if (tab === 'master_employee') return { rowNumber: 2, row: { outlet_id: 'HOME' } };
      return { rowNumber: 2, row: { outlet_id: value, latitude: value === 'VISITED' ? '-7.78' : '-6', longitude: '110.39', attendance_radius_m: '100' } };
    });
    const response = await POST(new Request('http://localhost/api/hr/telegram/clock-out', { method: 'POST', headers: { 'x-bot-secret': 'test-only' }, body: JSON.stringify({ telegram_chat_id: '123456789', latitude: -7.78, longitude: 110.39 }) }), { params: Promise.resolve({}) });
    expect(response.status).toBe(200);
    expect(lookup).toHaveBeenCalledWith('master_outlet', 'outlet_id', 'VISITED');
    expect(update).toHaveBeenCalled();
  });
});
