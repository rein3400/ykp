import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
const state = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, string>[]>, fail: false, outletId: '' }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ userId: 'U1', role: state.outletId ? 'outlet_manager' : 'owner', outletId: state.outletId, brandId: state.outletId ? 'B1' : '' }) }));
vi.mock('@/lib/audit', () => ({ logAudit: async () => undefined }));
vi.mock('@/lib/stock-ledger', () => ({ bookStock: async () => 20, appendMovement: async () => { if (state.fail) throw new Error('Posting unavailable'); } }));
vi.mock('@/db/sheets', async (original) => ({
  ...await original<typeof import('@/db/sheets')>(),
  readTab: async (tab: string) => state.rows[tab] ?? [],
  appendRows: async (tab: string, rows: Record<string, string>[]) => { (state.rows[tab] ??= []).push(...rows); },
  updateRow: async (tab: string, rowNumber: number, row: Record<string, string>) => { state.rows[tab][rowNumber - 2] = row; },
  findRow: async (tab: string, col: string, id: string) => {
    const row = tab === 'master_item' ? { item_id: id, base_unit: 'kg', active_status: 'active', brand_id: 'B1' }
      : tab === 'master_location' ? { location_id: id, brand_id: 'B1', outlet_id: 'O1', active_status: 'active' }
      : (state.rows[tab] ?? []).find((r) => r[col] === id);
    return row ? { row, rowNumber: 2 } : null;
  }
}));
const request = (body: unknown) => new NextRequest('http://localhost/api/warehouse/stock-issue', { method: 'POST', body: JSON.stringify(body) });
const context = { params: Promise.resolve({}) };
beforeEach(() => { state.rows = {}; state.fail = false; state.outletId = ''; });
describe('stock issue write safety', () => {
  it.each([null, { items: [null], source_location_id: 'L1' }])('rejects malformed body before persistence', async (body) => {
    expect((await POST(request(body), context)).status).toBe(400);
    expect(Object.keys(state.rows)).toHaveLength(0);
  });
  it('rejects source locations outside account scope', async () => {
    state.outletId = 'O2';
    expect((await POST(request({ source_location_id: 'L1', items: [{ item_id: 'I1', requested_qty: 2, issued_qty: 2, unit: 'kg' }] }), context)).status).toBe(403);
    expect(Object.keys(state.rows)).toHaveLength(0);
  });
  it('rejects an arbitrary unit instead of interpreting it as base stock', async () => {
    expect((await POST(request({ source_location_id: 'L1', items: [{ item_id: 'I1', requested_qty: 2, issued_qty: 2, unit: 'box' }] }), context)).status).toBe(400);
    expect(Object.keys(state.rows)).toHaveLength(0);
  });
  it('hides out-of-scope list and detail records', async () => {
    state.outletId = 'O2';
    state.rows.warehouse_stock_issue = [{ issue_id: 'X', outlet_id: 'O1', brand_id: 'B1' }];
    const listResponse = await GET(new NextRequest('http://localhost/api/warehouse/stock-issue'), context);
    expect(JSON.stringify(await listResponse.json())).not.toContain('"issue_id":"X"');
    expect((await GET(new NextRequest('http://localhost/api/warehouse/stock-issue?id=X'), context)).status).toBe(404);
  });
  it('preserves explicit zero issued quantity in details', async () => {
    const response = await POST(request({ source_location_id: 'L1', items: [{ item_id: 'I1', requested_qty: 2, issued_qty: 0, unit: 'kg' }] }), context);
    expect(response.status).toBe(201);
    expect(state.rows.warehouse_stock_issue_item[0].issued_qty).toBe('0');
  });
  it('does not label a partially posted document approved', async () => {
    state.fail = true;
    const response = await POST(request({ source_location_id: 'L1', items: [{ item_id: 'I1', requested_qty: 2, issued_qty: 2, unit: 'kg' }] }), context);
    expect(response.status).toBe(500);
    expect(state.rows.warehouse_stock_issue[0].approval_status).toBe('POSTING_FAILED');
    expect(state.rows.warehouse_stock_issue[0].approved_at).toBe('');
  });
});
