import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const db: Record<string, Record<string, string>[]> = {};

vi.mock('@/db/sheets', () => ({
  TABS: new Proxy({}, { get: (_t, key) => String(key) }),
  readTab: async (tab: string) => db[tab] ?? (db[tab] = []),
  appendRows: async (tab: string, rows: Record<string, string>[]) => {
    (db[tab] ??= []).push(...rows);
    return 2;
  },
  findRow: async () => null,
  updateRow: async () => undefined,
}));

const session = { userId: 'USR-1', role: 'owner', username: 'owner' };
vi.mock('@/lib/session', () => ({ getSession: async () => session }));
vi.mock('@/lib/audit', () => ({ logAudit: async () => undefined }));
vi.mock('@/lib/format', () => ({ nowTimestampWib: () => '2026-11-15 10:00:00' }));
vi.mock('@/lib/repo', () => {
  let n = 0;
  return { nextSequentialIdSync: (p: string) => `${p}-T${++n}` };
});

const { POST: supplierPost } = await import('@/app/api/warehouse/suppliers/route');
const { POST: itemPost } = await import('@/app/api/warehouse/items/route');
const { can } = await import('@/lib/rbac');

const params = { params: Promise.resolve({}) };
const post = (body: unknown) =>
  new NextRequest('http://localhost/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  for (const key of Object.keys(db)) delete db[key];
  session.role = 'owner';
});

describe('master creation', () => {
  it('creates a supplier with every field mapped, including bank details', async () => {
    const res = await supplierPost(
      post({
        supplier_name: 'CV Contoh',
        phone: '0812',
        bank_name: 'BCA',
        bank_account: '123',
        account_holder: 'Budi',
      }),
      params,
    );
    expect(res.status).toBe(201);
    const saved = db.suppliers[0];
    expect(saved.supplier_name).toBe('CV Contoh');
    expect(saved.phone).toBe('0812');
    expect(saved.bank_name).toBe('BCA');
    expect(saved.bank_account).toBe('123');
    expect(saved.account_holder).toBe('Budi');
    expect(saved.active_status).toBe('active');
  });

  it('rejects a supplier without a name', async () => {
    const res = await supplierPost(post({ phone: '0812' }), params);
    expect(res.status).toBe(400);
  });

  it('always stores an item code, falling back to the generated id', async () => {
    const res = await itemPost(
      post({ item_name: 'Item Tanpa Kode', brand_id: 'BR-1', base_unit: 'g', purchase_unit: 'g' }),
      params,
    );
    expect(res.status).toBe(201);
    expect(db.items[0].item_code).toBe(db.items[0].item_id);
  });
});

describe('warehouse role policy', () => {
  it('lets warehouse_admin raise a manual purchase request', () => {
    expect(can('warehouse_admin', 'create', 'purchase_request')).toBe(true);
  });

  it('keeps staff read-only on receiving, transfer, issue and waste', () => {
    for (const resource of ['receiving', 'transfer', 'stock_issue', 'waste', 'stock_count'] as const) {
      expect(can('staff', 'create', resource), resource).toBe(false);
    }
  });
});
