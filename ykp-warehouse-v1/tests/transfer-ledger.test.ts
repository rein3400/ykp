/**
 * Transfer ledger integrity.
 *
 * Regression: both legs used the transfer id as reference_id, so the second
 * leg always failed the duplicate guard and the error was swallowed — status
 * advanced while stock never moved.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const db: Record<string, Record<string, string>[]> = {};
const movements: Array<Record<string, string | number>> = [];
const state = { failWith: '' as string };

vi.mock('@/db/sheets', () => ({
  TABS: {
    transfer: 'warehouse_transfer',
    transferItem: 'warehouse_transfer_item',
    stockMovement: 'warehouse_stock_movement',
    alertLog: 'warehouse_alert_log',
    auditLog: 'system_audit_log',
    evidenceLog: 'warehouse_evidence_log',
    items: 'master_item',
    locations: 'master_location',
  },
  readTab: async (tab: string) => db[tab] ?? (db[tab] = []),
  appendRows: async (tab: string, rows: Record<string, string>[]) => {
    (db[tab] ??= []).push(...rows);
    return 2;
  },
  findRow: async (tab: string, col: string, val: string) => {
    const rows = db[tab] ?? [];
    const idx = rows.findIndex((r) => r[col] === val);
    return idx >= 0 ? { row: rows[idx], rowNumber: idx + 2 } : null;
  },
  updateRow: async (tab: string, rowNumber: number, row: Record<string, string>) => {
    (db[tab] ??= [])[rowNumber - 2] = row;
  },
}));

const session = { userId: 'USR-001', role: 'owner', username: 'owner' };
vi.mock('@/lib/session', () => ({ getSession: async () => session }));
vi.mock('@/lib/audit', () => ({ logAudit: async () => undefined }));
vi.mock('@/lib/format', () => ({
  nowTimestampWib: () => '2026-11-15 09:00:00',
  formatDateWib: () => '2026-11-15',
}));
vi.mock('@/lib/repo', () => {
  let n = 0;
  return {
    nextSequentialIdSync: (p: string) => `${p}-T${++n}`,
    MissingRefError: class MissingRefError extends Error {},
    assertItem: async () => true,
    assertLocation: async () => true,
  };
});
vi.mock('@/lib/stock-ledger', () => ({
  appendMovement: async (p: Record<string, unknown>) => {
    if (state.failWith) throw new Error(state.failWith);
    movements.push(p as Record<string, string | number>);
    return p;
  },
}));
vi.mock('@/lib/rules-engine', () => ({ evalTransferDiscrepancy: () => null, shouldCreateAction: () => false }));
vi.mock('@/lib/telegram', () => ({ dispatchAlertTelegram: async () => undefined }));
vi.mock('@/lib/evidence', () => ({ appendEvidenceRows: async () => undefined, parseEvidenceUrls: () => [] }));

const { PUT } = await import('@/app/api/warehouse/transfer/route');

const params = { params: Promise.resolve({}) };

function put(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/warehouse/transfer', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function seed(status: string, lines: string[] = ['TRI-1']) {
  db['warehouse_transfer'] = [
    {
      transfer_id: 'TRF-1',
      status,
      source_location_id: 'LOC-1',
      destination_location_id: 'LOC-2',
      updated_at: '',
    },
  ];
  db['warehouse_transfer_item'] = lines.map((id, i) => ({
    transfer_item_id: id,
    transfer_id: 'TRF-1',
    item_id: `ITM-${i + 1}`,
    requested_qty: '10',
    dispatched_qty: status === 'APPROVED' ? '0' : '10',
    received_qty: '0',
    unit: 'kg',
  }));
  db['warehouse_stock_movement'] = [];
}

beforeEach(() => {
  for (const key of Object.keys(db)) delete db[key];
  movements.length = 0;
  state.failWith = '';
  session.role = 'owner';
});

describe('transfer ledger legs', () => {
  it('posts TRANSFER_OUT with a leg-specific reference id and advances status', async () => {
    seed('APPROVED');
    const res = await PUT(put({ transfer_id: 'TRF-1', action: 'dispatch' }), params);
    expect(res.status).toBe(200);
    expect(movements).toHaveLength(1);
    expect(movements[0].movementType).toBe('TRANSFER_OUT');
    expect(movements[0].referenceId).toBe('TRF-1-OUT-TRI-1');
    expect(db['warehouse_transfer'][0].status).toBe('DISPATCHED');
  });

  it('posts TRANSFER_IN with a different reference than the OUT leg', async () => {
    seed('DISPATCHED');
    const res = await PUT(put({ transfer_id: 'TRF-1', action: 'receive' }), params);
    expect(res.status).toBe(200);
    expect(movements).toHaveLength(1);
    expect(movements[0].movementType).toBe('TRANSFER_IN');
    expect(movements[0].referenceId).toBe('TRF-1-IN-TRI-1');
    expect(db['warehouse_transfer'][0].status).toBe('RECEIVED');
  });

  it('posts one OUT per line so multi-item invoices do not collide', async () => {
    seed('APPROVED', ['TRI-1', 'TRI-2']);
    const res = await PUT(put({ transfer_id: 'TRF-1', action: 'dispatch' }), params);
    expect(res.status).toBe(200);
    expect(movements.map((m) => m.referenceId)).toEqual(['TRF-1-OUT-TRI-1', 'TRF-1-OUT-TRI-2']);
  });

  it('fails the request and keeps the status when the ledger rejects the post', async () => {
    seed('APPROVED');
    state.failWith = 'Insufficient stock: ITM-1 @ LOC-1 has 0, cannot move OUT 10';
    const res = await PUT(put({ transfer_id: 'TRF-1', action: 'dispatch' }), params);
    expect(res.status).toBe(409);
    expect(db['warehouse_transfer'][0].status).toBe('APPROVED');
    expect(db['warehouse_transfer_item'][0].dispatched_qty).toBe('0');
  });

  it('is idempotent when the same leg was already posted', async () => {
    seed('APPROVED');
    db['warehouse_stock_movement'] = [
      { reference_type: 'transfer', movement_type: 'TRANSFER_OUT', item_id: 'ITM-1', reference_id: 'TRF-1-OUT-TRI-1' },
    ];
    const res = await PUT(put({ transfer_id: 'TRF-1', action: 'dispatch' }), params);
    expect(res.status).toBe(200);
    expect(movements).toHaveLength(0);
    expect(db['warehouse_transfer'][0].status).toBe('DISPATCHED');
  });
});
