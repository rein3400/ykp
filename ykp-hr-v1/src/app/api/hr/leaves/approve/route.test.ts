import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
const state = vi.hoisted(() => ({ role: 'hr_admin', outletId: '', brandId: '', status: 'PENDING', chatId: '123' }));
const update = vi.hoisted(() => vi.fn(async () => undefined));
const notify = vi.hoisted(() => vi.fn(async () => ({ status: 'FAILED', sent: 0, failed: 1 })));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ userId: 'HR', ...state }) }));
vi.mock('@/lib/audit', () => ({ logAudit: async () => undefined }));
vi.mock('@/lib/telegram', () => ({ sendTelegram: notify }));
vi.mock('@/db/sheets', async (original) => ({
  ...await original<typeof import('@/db/sheets')>(), updateRow: update,
  findRow: async (tab: string) => ({ rowNumber: 2, row: tab === 'hr_leave_request' ? { leave_id: 'L1', employee_id: 'E1', approval_status: state.status } : { employee_id: 'E1', brand_id: 'BR1', outlet_id: 'OL1' } }),
  readTab: async () => [{ user_id: 'U1', employee_id: 'E1', telegram_id: state.chatId, active_status: 'active' }]
}));
const request = (reason: string) => new Request('http://localhost/api/hr/leaves/approve', { method: 'POST', body: JSON.stringify({ leave_id: 'L1', decision: 'REJECT', reason }) });
const context = { params: Promise.resolve({}) };
beforeEach(() => { state.role = 'hr_admin'; state.outletId = ''; state.brandId = ''; state.status = 'PENDING'; state.chatId = '123456789'; update.mockClear(); notify.mockClear(); });
describe('leave decision delivery', () => {
  it('rejects blank reason before persistence', async () => {
    expect((await POST(request('  '), context)).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
  it('persists and notifies linked employee without failing the decision on delivery failure', async () => {
    const response = await POST(request('Lengkapi surat'), context);
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipient: '123456789', text: expect.stringContaining('Lengkapi surat') }));
  });
  it('does not interpret a linked chat ID as a broadcast selector', async () => {
    state.chatId = 'role:employee';
    expect((await POST(request('Lengkapi surat'), context)).status).toBe(200);
    expect(notify).not.toHaveBeenCalled();
  });
  it('rejects a scoped approver deciding another outlet employee', async () => {
    state.outletId = 'OL2';
    expect((await POST(request('Lengkapi surat'), context)).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });
});
