/**
 * Regression: PG-mode upsert must target the real __rownum, not the Sheets
 * index+2 convention. Bug (2026-09-09): PG __rownum starts at 1 while the
 * upsert map assumed index+2 → re-sync updated the NEIGHBOUR row →
 * `duplicate key value violates unique constraint "fin_pos_daily_pkey"`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/db/postgres', () => ({ isPostgresMode: () => true }));

const sheetStore: Record<string, Record<string, string>[]> = {};
const updateCalls: { tab: string; rowNumber: number; values: Record<string, string> }[] = [];
vi.mock('../src/db/sheets', () => ({
  TABS: {
    outlets: 'master_outlet', brands: 'master_brand',
    posDaily: 'fin_pos_daily', posItems: 'fin_pos_items', appSettings: 'app_settings'
  },
  readTab: vi.fn(async (tab: string) => sheetStore[tab] ?? []),
  appendRows: vi.fn(async (tab: string, rows: Record<string, string>[]) => {
    sheetStore[tab] = [...(sheetStore[tab] ?? []), ...rows];
    return (sheetStore[tab]?.length ?? 0) + 1;
  }),
  updateRow: vi.fn(async (tab: string, rowNumber: number, values: Record<string, string>) => {
    updateCalls.push({ tab, rowNumber, values });
  }),
  findRow: vi.fn(async (tab: string, keyCol: string, value: string) => {
    const arr = sheetStore[tab] ?? [];
    const idx = arr.findIndex((r) => r[keyCol] === value);
    return idx >= 0 ? { rowNumber: idx + 2, row: arr[idx] } : null;
  })
}));

vi.mock('../src/lib/moka-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/moka-client')>();
  return {
    ...actual,
    refreshAccessToken: vi.fn(async () => ({ access_token: 'tok', refresh_token: 'r', expires_at: Date.now() + 3600_000 })),
    exchangeAuthorizationCode: vi.fn(),
    tryClientCredentials: vi.fn(),
    mokaGet: vi.fn()
  };
});

import { runMokaSync } from '../src/lib/moka-sync';
import { mokaGet } from '../src/lib/moka-client';

beforeEach(() => {
  sheetStore.master_outlet = [{ outlet_id: 'OL-008', brand_id: 'BR-002', outlet_name: 'Sekar Pizza Tirtodipuran' }];
  sheetStore.master_brand = [{ brand_id: 'BR-002', brand_name: 'Sekarpizza' }];
  // Existing PG rows: __rownum 1..3 — OL-008's row is the LAST one. With the
  // old index+2 map the update for this row would have targeted rowNumber 3
  // (the neighbour) instead of 12.
  sheetStore.fin_pos_daily = [
    { __rownum: '10', date: '2026-09-07', outlet_id: 'OL-008', pos_id: 'POS-OLD-A', created_at: 't0' },
    { __rownum: '11', date: '2026-09-07', outlet_id: 'OL-009', pos_id: 'POS-OLD-B', created_at: 't0' },
    { __rownum: '12', date: '2026-09-08', outlet_id: 'OL-008', pos_id: 'POS-EXISTING-8', created_at: 't0' }
  ];
  sheetStore.fin_pos_items = [
    { __rownum: '30', date: '2026-09-08', outlet_id: 'OL-008', item_name: 'Kopi Susu', pos_item_id: 'POSI-OLD', created_at: 't0' }
  ];
  sheetStore.app_settings = [
    { setting_key: 'moka_token:772618', setting_value: JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Date.now() + 3600_000 }) },
    { setting_key: 'moka_outlet_map', setting_value: JSON.stringify({ '772618': 'OL-008' }) }
  ];
  updateCalls.length = 0;
  (mokaGet as ReturnType<typeof vi.fn>).mockImplementation(async (_token: string, ver: string) => {
    if (ver === '2') {
      return { data: { data: { total_collected: { value: 1712000 }, total_price: { value: 2000000 }, total_discount: { value: 0 }, total_refund: { value: 0 }, total_void: { value: 0 }, total_tax: { value: 0 }, total_service: { value: 0 }, total_transaction: 5, settlement_summary: [] } } };
    }
    return { data: { item_sales: [{ name: 'Kopi Susu', sku: '', category_name: 'BEVERAGES', item_sold: 10, gross_sales: 1000000, discount: 0, refund: 0, net_sales: 1000000 }] } };
  });
});

describe('moka sync PG-mode upsert (rowNumber = __rownum)', () => {
  it('re-sync over existing PG rows updates by __rownum, not index+2', async () => {
    process.env.MOKA_OUTLETS = 'TEST';
    process.env.MOKA_TEST_CLIENT_ID = 'c';
    process.env.MOKA_TEST_CLIENT_SECRET = 's';
    process.env.MOKA_TEST_OUTLET_ID = '772618';

    const res = await runMokaSync({ date: '2026-09-08', outletKey: 'TEST', actor: 'test' });
    expect(res.outlets[0].status).toBe('ok');
    expect(res.outlets[0].daily).toEqual({ written: 0, updated: 1 });
    // the update must have hit __rownum 12 (the existing OL-008 row), never 3
    const dailyUpdate = updateCalls.find((c) => c.tab === 'fin_pos_daily');
    expect(dailyUpdate?.rowNumber).toBe(12);
    expect(dailyUpdate?.values.pos_id).toBe('POS-EXISTING-8');
    const itemUpdate = updateCalls.find((c) => c.tab === 'fin_pos_items');
    expect(itemUpdate?.rowNumber).toBe(30);
  });
});