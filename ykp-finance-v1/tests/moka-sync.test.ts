import { describe, it, expect } from 'vitest';
import {
  parseOutletKeys,
  mokaDateToIso,
  isoToMokaDate,
  tokenNeedsRefresh
} from '../src/lib/moka-client';
import {
  toIdrInt,
  extractSummary,
  extractItemSales,
  upsertRows
} from '../src/lib/moka-sync';

describe('moka-client', () => {
  describe('parseOutletKeys', () => {
    it('collects fully configured outlets', () => {
      const env = {
        MOKA_OUTLETS: 'A,B',
        MOKA_A_CLIENT_ID: 'id-a',
        MOKA_A_CLIENT_SECRET: 'sec-a',
        MOKA_A_OUTLET_ID: '999',
        MOKA_B_CLIENT_ID: 'id-b',
        MOKA_B_CLIENT_SECRET: 'sec-b',
        MOKA_B_OUTLET_ID: '888'
      };
      const r = parseOutletKeys(env as unknown as NodeJS.ProcessEnv);
      expect(r.configured).toHaveLength(2);
      expect(r.configured[0].key).toBe('A');
      expect(r.configured[0].mokaOutletId).toBe('999');
      expect(r.incomplete).toHaveLength(0);
    });

    it('reports incomplete outlets with missing var names, never values', () => {
      const env = {
        MOKA_OUTLETS: 'A',
        MOKA_A_CLIENT_ID: 'id-a'
      };
      const r = parseOutletKeys(env as unknown as NodeJS.ProcessEnv);
      expect(r.configured).toHaveLength(0);
      expect(r.incomplete[0].missing).toContain('MOKA_A_CLIENT_SECRET');
      expect(r.incomplete[0].missing).toContain('MOKA_A_OUTLET_ID');
    });
  });

  describe('date adapters', () => {
    it('converts DD/MM/YYYY to YYYY-MM-DD and back', () => {
      expect(mokaDateToIso('04/09/2026')).toBe('2026-09-04');
      expect(isoToMokaDate('2026-09-04')).toBe('04/09/2026');
 expect(mokaDateToIso(isoToMokaDate('2026-12-31'))).toBe('2026-12-31');
    });

    it('accepts already-ISO dates and empty input', () => {
      expect(mokaDateToIso('2026-09-04')).toBe('2026-09-04');
      expect(mokaDateToIso('')).toBe('');
      expect(mokaDateToIso(null)).toBe('');
      expect(isoToMokaDate('garbage')).toBe('');
    });
  });

  describe('tokenNeedsRefresh', () => {
    it('true when missing or within 5-minute window of expiry', () => {
      expect(tokenNeedsRefresh(null)).toBe(true);
      expect(tokenNeedsRefresh({ expires_at: 0 })).toBe(true);
      const now = 1_000_000_000_000;
      expect(tokenNeedsRefresh({ expires_at: now + 4 * 60_000 }, now)).toBe(true);
      expect(tokenNeedsRefresh({ expires_at: now + 10 * 60_000 }, now)).toBe(false);
    });
  });
});

describe('moka-sync normalizers', () => {
  it('toIdrInt keeps non-negative integers', () => {
    expect(toIdrInt(1234.6)).toBe(1235);
    expect(toIdrInt('-5000')).toBe(5000);
    expect(toIdrInt('Rp 1.234.567')).toBe(1234567);
    expect(toIdrInt(undefined)).toBe(0);
    expect(toIdrInt('abc')).toBe(0);
  });

  it('extractSummary maps spec-shaped single object', () => {
    const p = {
      gross_sales: 5000000,
      net_sales: 4800000,
      discount: 100000,
      refund: 100000,
      void: 0,
      tax: 55000,
      service_charge: 25000,
      transaction_count: 100,
      date: '04/09/2026',
      payments: [{ type: 'CASH', amount: 2800000 }, { type: 'QRIS', amount: 2000000 }]
    };
    const s = extractSummary(p, '2026-09-04');
    expect(s).not.toBeNull();
    expect(s!.date).toBe('2026-09-04');
    expect(s!.grossSales).toBe(5_000_000);
    expect(s!.netSales).toBe(4_800_000);
    expect(s!.settleCash).toBe(2_800_000);
    expect(s!.settleQris).toBe(2_000_000);
  });

  it('extractSummary picks matching date entry from data array', () => {
    const p = {
      data: [
        { date: '03/09/2026', gross_sales: 1000, net_sales: 900 },
        { date: '04/09/2026', gross_sales: 7000, net_sales: 6500, total_collected: 7000 }
      ]
    };
    const s = extractSummary(p, '2026-09-04');
    expect(s!.grossSales).toBe(7000);
    expect(s!.netSales).toBe(6500);
  });

  it('extractSummary derives net from gross-discount-refund when absent', () => {
    const s = extractSummary({ total_amount: 1000, total_discount: 100, total_refund: 50 }, '2026-09-04');
    expect(s!.netSales).toBe(850);
  });

  it('extractSummary returns null on empty payload', () => {
    expect(extractSummary({}, '2026-09-04')).not.toBeNull(); // single-object fallback still yields entry
    expect(extractSummary({ data: [] }, '2026-09-04')).toBeNull();
    expect(extractSummary(null, '2026-09-04')).toBeNull();
  });

  it('extractItemSales filters by date and normalizes rows', () => {
    const p = {
      data: [
        { date: '04/09/2026', item_name: 'Pizza Reguler', qty: 12, gross_sales: 600000, net_sales: 540000, category: 'Pizza' },
        { date: '03/09/2026', item_name: 'Lama', qty: 1, gross_sales: 10 },
        { item_name: '', qty: 5 }
      ]
    };
    const rows = extractItemSales(p, '2026-09-04');
    expect(rows).toHaveLength(1);
    expect(rows[0].itemName).toBe('Pizza Reguler');
    expect(rows[0].qty).toBe(12);
    expect(rows[0].netSales).toBe(540_000);
  });
});

describe('upsertRows (idempotency)', () => {
  const keyOf = (r: Record<string, string>) => `${r.date}|${r.outlet_id}`;

  it('appends new rows and skips duplicates inside one batch', () => {
    const incoming = [
      { date: '2026-09-04', outlet_id: 'OL-001', v: '1' },
      { date: '2026-09-04', outlet_id: 'OL-001', v: '2' }, // same key → last wins
      { date: '2026-09-04', outlet_id: 'OL-002', v: '3' }
    ];
    const r = upsertRows([], new Map(), incoming, keyOf);
    expect(r.updates).toHaveLength(0);
    expect(r.appends).toHaveLength(2);
    expect(r.appends[0].outlet_id).toBe('OL-002'); // reversed to first-seen order
    expect(r.appends[1].v).toBe('2');
  });

  it('updates existing rows by composite key instead of duplicating', () => {
    const existing = [{ date: '2026-09-04', outlet_id: 'OL-001', v: 'old' }];
    const rowNumbers = new Map([['2026-09-04|OL-001', 2]]);
    const r = upsertRows(existing, rowNumbers, [{ date: '2026-09-04', outlet_id: 'OL-001', v: 'new' }], keyOf);
    expect(r.updates).toHaveLength(1);
    expect(r.updates[0].rowNumber).toBe(2);
    expect(r.updates[0].values.v).toBe('new');
    expect(r.appends).toHaveLength(0);
  });

  it('re-running the same sync is a no-op update (idempotent)', () => {
    const row = { date: '2026-09-04', outlet_id: 'OL-001', v: 'x' };
    const rowNumbers = new Map([['2026-09-04|OL-001', 2]]);
    const first = upsertRows([], new Map(), [row], keyOf);
    expect(first.appends).toHaveLength(1);
    const second = upsertRows([row], rowNumbers, [row], keyOf);
    expect(second.appends).toHaveLength(0);
    expect(second.updates).toHaveLength(1);
  });
});
// ── runMokaSync orchestration (mocked Sheets + Moka transport) ─────────
import { vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

const sheetStore: Record<string, Record<string, string>[]> = {};
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
    const arr = sheetStore[tab] ?? [];
    if (arr[rowNumber - 2]) Object.assign(arr[rowNumber - 2], values);
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
import { mokaGet, refreshAccessToken } from '../src/lib/moka-client';

const OUTLETS = [
  { outlet_id: 'OL-001', outlet_name: 'Funkydak Cipete', brand_id: 'BR-001' },
  { outlet_id: 'OL-002', outlet_name: 'Sekarpizza', brand_id: 'BR-002' }
];
const BRANDS = [{ brand_id: 'BR-001', brand_name: 'Funkydak' }];

function seedEnv() {
  process.env.MOKA_OUTLETS = 'GOOD,BAD,UNMAPPED';
  process.env.MOKA_GOOD_CLIENT_ID = 'id';
  process.env.MOKA_GOOD_CLIENT_SECRET = 'sec';
  process.env.MOKA_GOOD_OUTLET_ID = '111';
  process.env.MOKA_BAD_CLIENT_ID = 'id';
  process.env.MOKA_BAD_CLIENT_SECRET = 'sec';
  process.env.MOKA_BAD_OUTLET_ID = '222';
  process.env.MOKA_UNMAPPED_CLIENT_ID = 'id';
  process.env.MOKA_UNMAPPED_CLIENT_SECRET = 'sec';
  process.env.MOKA_UNMAPPED_OUTLET_ID = '333';
}

beforeEach(() => {
  for (const k of Object.keys(sheetStore)) delete sheetStore[k];
  sheetStore['master_outlet'] = [...OUTLETS];
  sheetStore['master_brand'] = [...BRANDS];
  const future = Date.now() + 3600_000;
  const tok = (r: string) => JSON.stringify({ access_token: 'tok', refresh_token: r, expires_at: future });
  sheetStore['app_settings'] = [
    { setting_key: 'moka_outlet_map', setting_value: JSON.stringify({ '111': 'OL-001', '222': 'OL-002' }), description: '', updated_by: '', updated_at: '' },
    { setting_key: 'moka_token:111', setting_value: tok('r-good'), description: '', updated_by: '', updated_at: '' },
    { setting_key: 'moka_token:222', setting_value: tok('r-bad'), description: '', updated_by: '', updated_at: '' }
  ];
  seedEnv();
});

afterEach(() => {
  delete process.env.MOKA_OUTLETS;
  (mokaGet as Mock).mockReset();
  (refreshAccessToken as Mock).mockClear();
});

describe('runMokaSync orchestration', () => {
  it('isolates per-outlet failure: one error does not stop the other', async () => {
    (mokaGet as Mock).mockImplementation((_tok: string, path: string) => {
      if (path.includes('/outlets/111/')) {
        if (path.includes('sales_summary')) {
          return { data: [{ date: '04/09/2026', gross_sales: 1000, net_sales: 900, transaction_count: 2 }] };
        }
        return { data: [] };
      }
      throw new Error('HTTP 500'); // outlet 111 = Moka outlet id '111' → GOOD; BAD uses 222
    });

    const r = await runMokaSync({ date: '2026-09-04', actor: 'test' });
    expect(r.outlets).toHaveLength(3);
    const good = r.outlets.find((o) => o.outlet_key === 'GOOD')!;
    const bad = r.outlets.find((o) => o.outlet_key === 'BAD')!;
    expect(good.status).toBe('ok');
    expect(good.daily.written).toBe(1);
    expect(bad.status).toBe('error');
    expect(bad.error).toContain('HTTP 500');
    expect(sheetStore['fin_pos_daily']).toHaveLength(1);
  });

  it('reports unmapped Moka outlet explicitly without writing rows', async () => {
    (mokaGet as Mock).mockResolvedValue({ data: [] });
    const r = await runMokaSync({ date: '2026-09-04', outletKey: 'UNMAPPED', actor: 'test' });
    expect(r.outlets).toHaveLength(1);
    expect(r.outlets[0].status).toBe('error');
    expect(r.outlets[0].error).toContain('belum dipetakan');
    expect(sheetStore['fin_pos_daily']).toBeUndefined();
  });

  it('reports needs_reauth when stored token is marked needs_reauth', async () => {
    sheetStore['app_settings'] = sheetStore['app_settings'].map((s) =>
      s.setting_key === 'moka_token:111' ? { ...s, setting_value: JSON.stringify({ needs_reauth: '1' }) } : s
    );
    (mokaGet as Mock).mockResolvedValue({ data: [] });
    const r = await runMokaSync({ date: '2026-09-04', outletKey: 'GOOD', actor: 'test' });
    expect(r.outlets[0].status).toBe('needs_reauth');
  });

  it('re-running the same date updates instead of duplicating', async () => {
    (mokaGet as Mock).mockImplementation((_tok: string, path: string) => {
      if (path.includes('sales_summary')) {
        return { data: [{ date: '04/09/2026', gross_sales: 1000, net_sales: 900, transaction_count: 2 }] };
      }
      return { data: [] };
    });
    const first = await runMokaSync({ date: '2026-09-04', outletKey: 'GOOD', actor: 'test' });
    expect(first.outlets[0].daily.written).toBe(1);
    const r2 = await runMokaSync({ date: '2026-09-04', outletKey: 'GOOD', actor: 'test' });
    expect(r2.outlets[0].status).toBe('ok');
    expect(sheetStore['fin_pos_daily']).toHaveLength(1);
    expect(r2.outlets[0].daily.updated).toBe(1);
    expect(r2.outlets[0].daily.written).toBe(0);
  });
});

describe('quota gate (task 3.5)', () => {
  it('stops the outlet when remaining quota is 0', async () => {
    (mokaGet as Mock).mockImplementation((_tok: string, path: string) => {
      if (path.startsWith('/v1/quotas')) return { data: { remaining: 0 } };
      return { data: [] };
    });
    const r = await runMokaSync({ date: '2026-09-04', outletKey: 'GOOD', actor: 'test' });
    expect(r.outlets[0].status).toBe('error');
    expect(r.outlets[0].error).toContain('QUOTA_EXHAUSTED');
  });

  it('proceeds when quota endpoint is unclear (best-effort check)', async () => {
    (mokaGet as Mock).mockImplementation((_tok: string, path: string) => {
      if (path.startsWith('/v1/quotas')) return { weird: 'shape' };
      if (path.includes('sales_summary')) {
        return { data: [{ date: '04/09/2026', gross_sales: 1000, net_sales: 900, transaction_count: 2 }] };
      }
      return { data: [] };
    });
    const r = await runMokaSync({ date: '2026-09-04', outletKey: 'GOOD', actor: 'test' });
    expect(r.outlets[0].status).toBe('ok');
  });
});

describe('authorizeMokaOutlet (one-time setup)', () => {
  it('exchanges code and stores token', async () => {
    const { saveStoredToken, getStoredToken } = await import('../src/lib/moka-sync');
    const spy = vi.spyOn(await import('../src/lib/moka-sync'), 'saveStoredToken');
    const { authorizeMokaOutlet } = await import('../src/lib/moka-sync');
    const { exchangeAuthorizationCode } = await import('../src/lib/moka-client');
    (exchangeAuthorizationCode as Mock).mockResolvedValue({ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 600_000 });
    const res = await authorizeMokaOutlet({ outletKey: 'GOOD', code: 'abc', actor: 'test' });
    expect(res.ok).toBe(true);
    expect(res.mode).toBe('authorization_code');
    expect((await getStoredToken('111'))!.access_token).toBe('a');
    spy.mockRestore();
    void saveStoredToken;
  });

  it('probes client_credentials when no code given (unsupported → clear error)', async () => {
    const { authorizeMokaOutlet } = await import('../src/lib/moka-sync');
    const { tryClientCredentials } = await import('../src/lib/moka-client');
    (tryClientCredentials as Mock).mockRejectedValue(new Error('Moka token request failed: unsupported_grant_type'));
    const res = await authorizeMokaOutlet({ outletKey: 'GOOD', actor: 'test' });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('unsupported_grant_type');
  });

  it('fails clearly for unknown outlet key', async () => {
    const { authorizeMokaOutlet } = await import('../src/lib/moka-sync');
    const res = await authorizeMokaOutlet({ outletKey: 'NOPE', actor: 'test' });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('tidak ditemukan');
  });
});

describe('ground-truth shapes (spike 2026-09-09)', () => {
  const REAL_SUMMARY = {
    data: {
      gross_sales: 11510000, discounts: 0, refunds: 286000, net_sales: 11224000,
      gratuities: 946900, taxes: 0, total_collected: 12170900,
      number_of_transactions: 153, rounding_amount: 0, redemption: 0
    },
    meta: { code: 200, errors: {} }
  };

  it('extractSummary parses the real sales_summary payload', () => {
    const s = extractSummary(REAL_SUMMARY, '2026-09-07');
    expect(s!.grossSales).toBe(11_510_000);
    expect(s!.netSales).toBe(11_224_000);
    expect(s!.discount).toBe(0);
    expect(s!.refund).toBe(286_000);
    expect(s!.tax).toBe(0);
    expect(s!.serviceCharge).toBe(946_900);
    expect(s!.transactionCount).toBe(153);
    expect(s!.date).toBe('2026-09-07'); // falls back to requested date
  });

  const REAL_ITEMS = {
    data: {
      item_sales: [
        { name: 'A & W', sku: '', category_name: 'BEVERAGES - DISPLAY', item_sold: 14, item_refunded: 0, gross_sales: 168000, discount: 0, refund: 0, net_sales: 168000, cogs: 65338, gross_profit: 102662 },
        { name: 'A Cup of Ice', item_sold: 12, gross_sales: 36000, discount: 0, refund: 0, net_sales: 36000 }
      ],
      total_item_sold: 371, total_net_sales: 11224000
    }
  };

  it('extractItemSales parses the real item_sales payload', () => {
    const rows = extractItemSales(REAL_ITEMS, '2026-09-07');
    expect(rows).toHaveLength(2);
    expect(rows[0].itemName).toBe('A & W');
    expect(rows[0].category).toBe('BEVERAGES - DISPLAY');
    expect(rows[0].qty).toBe(14);
    expect(rows[0].netSales).toBe(168_000);
  });
});

describe('MOKA_OUTLET_MAP env bootstrap', () => {
  it('seeds the map once when app_settings is empty', async () => {
    sheetStore['app_settings'] = sheetStore['app_settings'].filter((s) => s.setting_key !== 'moka_outlet_map');
    process.env.MOKA_OUTLET_MAP = JSON.stringify({ '111': 'OL-001' });
    const r = await runMokaSync({ date: '2026-09-04', outletKey: 'GOOD', actor: 'test' });
    expect(r.outlets[0].status).toBe('ok');
    const stored = sheetStore['app_settings'].find((s) => s.setting_key === 'moka_outlet_map')!;
    expect(JSON.parse(stored.setting_value)['111']).toBe('OL-001');
    delete process.env.MOKA_OUTLET_MAP;
  });

  it('keeps existing stored map and survives invalid JSON', async () => {
    process.env.MOKA_OUTLET_MAP = '{invalid';
    const r = await runMokaSync({ date: '2026-09-04', outletKey: 'GOOD', actor: 'test' });
    expect(r.outlets[0].status).toBe('ok');
    const stored = sheetStore['app_settings'].find((s) => s.setting_key === 'moka_outlet_map')!;
    expect(stored.setting_value).toBe(JSON.stringify({ '111': 'OL-001', '222': 'OL-002' }));
    delete process.env.MOKA_OUTLET_MAP;
  });
});
