import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({ rows: [] as Record<string, string>[], writes: [] as Record<string, string>[], updated: [] as string[] }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ userId: 'U1', role: 'staff', brandId: 'BR1', outletId: 'OL1' }) }));
vi.mock('@/db/sheets', () => ({
  TABS: { outlets: 'outlets', checklistSubmissions: 'submissions' },
  readTab: async () => state.rows,
  findRow: async (tab: string, _key: string, id: string) => tab === 'outlets'
    ? { row: { outlet_id: id, brand_id: 'BR1' }, rowIndex: 2 }
    : { row: state.rows.find(row => row.submission_id === id), rowIndex: 2 },
  appendRows: async (_tab: string, rows: Record<string, string>[]) => { state.writes.push(...rows); return 2; },
  updateRow: async (_tab: string, _index: number, row: Record<string, string>) => { state.updated.push(row.submission_id); },
}));
vi.mock('@/lib/audit', () => ({ logAudit: async () => undefined }));
vi.mock('@/lib/repo', () => ({ nextSequentialIdSync: () => 'NEW' }));
vi.mock('@/lib/format', () => ({ todayWib: () => '2026-11-18', nowTimestampWib: () => '2026-11-18 12:00:00' }));
import { POST } from './route';

const submit = (outlet = 'OL1') => POST(new NextRequest('http://localhost/api/ops/checklist', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ outlet_id: outlet, shift_id: 'S1', checklist_type: 'OPENING', items: [{ checklist_item: 'Kasir task', department: 'Kasir', status: 'DONE' }] }),
}), { params: Promise.resolve({}) });

beforeEach(() => { state.rows = []; state.writes = []; state.updated = []; });
describe('staff checklist boundaries', () => {
  it('rejects submissions outside the assigned outlet without writes', async () => {
    expect((await submit('OL2')).status).toBe(403);
    expect(state.writes).toHaveLength(0);
  });
  it('preserves another department when correcting one category', async () => {
    state.rows = [
      { submission_id: 'KITCHEN', date: '2026-11-18', outlet_id: 'OL1', shift_id: 'S1', checklist_type: 'OPENING', department: 'Kitchen', status: 'DONE' },
      { submission_id: 'CASHIER', date: '2026-11-18', outlet_id: 'OL1', shift_id: 'S1', checklist_type: 'OPENING', department: 'Kasir', status: 'DONE' },
    ];
    expect((await submit()).status).toBe(201);
    expect(state.updated).toEqual(['CASHIER']);
    expect(state.writes[0].submitted_by).toBe('U1');
  });
});
