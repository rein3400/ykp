import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, PUT } from './route';
const state = vi.hoisted(() => ({ role: 'owner', outletId: '', brandId: '' }));
const append = vi.hoisted(() => vi.fn(async () => 2));
const update = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ userId: 'U1', ...state }) }));
vi.mock('@/lib/audit', () => ({ logAudit: async () => undefined }));
vi.mock('@/db/sheets', async (original) => ({
  ...await original<typeof import('@/db/sheets')>(), appendRows: append, updateRow: update,
  readTab: async () => [],
  findRow: async (tab: string) => ({ rowIndex: 2, row: tab === 'master_outlet' ? { outlet_id: 'OL1', brand_id: 'BR3', status: 'active' } : { checklist_template_id: 'T1', outlet_id: 'OL1', brand_id: 'BR3' } })
}));
const ctx = { params: Promise.resolve({}) };
const req = (body: unknown, method = 'POST') => new NextRequest('http://localhost/api/ops/checklist-templates', { method, body: JSON.stringify(body) });
beforeEach(() => { state.role = 'owner'; state.outletId = ''; state.brandId = ''; append.mockClear(); update.mockClear(); });
describe('template management API', () => {
  it('derives brand from selected outlet, never from client hardcode', async () => {
    const result = await POST(req({ outlet_id: 'OL1', brand_id: 'BR1', checklist_type: 'OPENING', department: 'FOH', checklist_item: 'Cek POS' }), ctx);
    expect(result.status).toBe(201);
    expect(append).toHaveBeenCalledWith(expect.any(String), [expect.objectContaining({ brand_id: 'BR3', outlet_id: 'OL1' })]);
  });
  it('denies non-master roles and out-of-scope outlet writes', async () => {
    state.role = 'employee';
    expect((await POST(req({}), ctx)).status).toBe(403);
    state.role = 'owner'; state.outletId = 'OL2';
    expect((await POST(req({ outlet_id: 'OL1', checklist_type: 'OPENING', checklist_item: 'Cek POS' }), ctx)).status).toBe(403);
    expect(append).not.toHaveBeenCalled();
  });
  it('rejects malformed input and only permits activation state changes', async () => {
    expect((await POST(req(null), ctx)).status).toBe(400);
    expect((await PUT(req({ checklist_template_id: 'T1', active_status: 'inactive', brand_id: 'WRONG' }, 'PUT'), ctx)).status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.any(String), 2, expect.objectContaining({ brand_id: 'BR3', active_status: 'inactive' }));
  });
});
