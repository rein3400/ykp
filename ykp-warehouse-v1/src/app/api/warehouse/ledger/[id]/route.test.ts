import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  role: 'outlet_manager',
  rows: [] as Record<string, string>[],
  audited: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/session', () => ({ getSession: async () => ({ userId: 'U1', role: state.role, brandId: 'BR-2' }) }));
vi.mock('@/db/sheets', async (original) => ({
  ...(await original<typeof import('@/db/sheets')>()),
  readTab: async () => state.rows,
  findRow: async (_tab: string, key: string, value: string) => {
    const index = state.rows.findIndex((row) => row[key] === value);
    return index >= 0 ? { row: state.rows[index], rowNumber: index + 2 } : null;
  },
  updateRow: async (_tab: string, rowNumber: number, values: Record<string, string>) => {
    state.rows[rowNumber - 2] = values;
  },
}));
vi.mock('@/lib/audit', () => ({ logAudit: async (entry: Record<string, unknown>) => { state.audited.push(entry); } }));

const { PUT } = await import('./route');
const context = { params: Promise.resolve({ id: 'MV-1' }) };
const put = (body: unknown) => new NextRequest('http://localhost/api/warehouse/ledger/MV-1', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

beforeEach(() => {
  state.role = 'outlet_manager';
  state.audited = [];
  state.rows = [{
    movement_id: 'MV-1',
    movement_datetime: '2026-11-02 10:00:00',
    item_id: 'ITM-1',
    location_id: 'LOC-1',
    movement_type: 'RECEIPT',
    direction: 'IN',
    quantity: '1000',
    base_unit: 'g',
    unit_cost: '120',
    total_value: '120000',
    stock_before: '0',
    stock_after: '1000',
    reference_id: 'RCV-1-L1',
    notes: '',
  }];
});

describe('stock ledger correction', () => {
  it('corrects unit cost, recalculates total and records an audit trail', async () => {
    const res = await PUT(put({ unit_cost: '150.5', notes: 'Harga faktur dikoreksi', reason: 'Salah input harga' }), context);
    expect(res.status).toBe(200);
    expect(state.rows[0].unit_cost).toBe('150.5');
    expect(state.rows[0].total_value).toBe('150500');
    expect(state.rows[0].notes).toBe('Harga faktur dikoreksi');
    expect(state.audited[0]).toMatchObject({ action: 'update', recordType: 'stock_ledger', recordId: 'MV-1' });
  });

  it('rejects editing quantities, movement type or location', async () => {
    for (const body of [{ quantity: '900' }, { movement_type: 'ISSUE' }, { location_id: 'LOC-2' }]) {
      const res = await PUT(put({ ...body, reason: 'coba ubah' }), context);
      expect(res.status).toBe(400);
    }
    expect(state.rows[0].quantity).toBe('1000');
  });

  it('requires a reason and a valid cost', async () => {
    expect((await PUT(put({ unit_cost: '150' }), context)).status).toBe(400);
    expect((await PUT(put({ unit_cost: '-1', reason: 'koreksi harga' }), context)).status).toBe(400);
  });

  it('denies read-only roles', async () => {
    state.role = 'staff';
    expect((await PUT(put({ unit_cost: '150', reason: 'koreksi harga' }), context)).status).toBe(403);
  });
});
