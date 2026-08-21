/**
 * Batch-stock-on-receipt tests — mocked Sheets layer.
 *
 * Drives the REAL receiving POST handler against an in-memory fake of
 * @/db/sheets and asserts the batch_stock tab is updated:
 *   1. A receipt with a new batch_number inserts a batch_stock row with the
 *      accepted qty, expiry, unit, and computed status.
 *   2. A second receipt for the same (item, location, batch_number) INCREMENTS
 *      current_qty instead of inserting a duplicate row.
 *   3. A receipt without a batch_number does NOT touch batch_stock (no row added).
 *
 * Also drives the pure upsertBatchStockOnReceipt helper directly so the
 * increment/insert/status logic is covered without HTTP.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ── In-memory Sheets fake ─────────────────────────────────────────
interface FakeTab { rows: Record<string, string>[] }
const db: Record<string, FakeTab> = {};

function tabRows(tab: string): Record<string, string>[] {
  return (db[tab] ??= { rows: [] }).rows;
}

vi.mock('@/db/sheets', async () => {
  const TABS = {
    adjustment: 'warehouse_stock_adjustment',
    receiving: 'warehouse_receiving',
    receivingItem: 'warehouse_receiving_item',
    items: 'master_item',
    suppliers: 'master_supplier',
    locations: 'master_location',
    stockMovement: 'warehouse_stock_movement',
    batchStock: 'warehouse_batch_stock',
    alertLog: 'warehouse_alert_log',
    actionTracker: 'warehouse_action_tracker',
    auditLog: 'system_audit_log',
    attachments: 'warehouse_attachments',
    telegramDeliveryLog: 'telegram_delivery_log'
  } as const;
  return {
    TABS,
    readTab: async (tab: string) => tabRows(tab),
    appendRows: async (tab: string, rows: Record<string, string>[]) => {
      tabRows(tab).push(...rows);
      return 2;
    },
    findRow: async (tab: string, col: string, val: string) => {
      const rows = tabRows(tab);
      const idx = rows.findIndex((r) => r[col] === val);
      return idx >= 0 ? { row: rows[idx], rowNumber: idx + 2 } : null;
    },
    updateRow: async (tab: string, rowNumber: number, row: Record<string, string>) => {
      tabRows(tab)[rowNumber - 2] = row;
    }
  };
});

const session = { userId: 'USR-001', role: 'owner', username: 'owner' };
vi.mock('@/lib/session', () => ({ getSession: async () => session }));

vi.mock('@/lib/repo', async () => {
  let n = 0;
  return {
    nextSequentialIdSync: (p: string) => `${p}-T${++n}`,
    MissingRefError: class MissingRefError extends Error {},
    assertItem: async () => true,
    assertSupplier: async () => true,
    assertLocation: async () => true
  };
});

vi.mock('@/lib/evidence', () => ({
  parseEvidenceUrls: (v: unknown) => (Array.isArray(v) ? v : []),
  appendEvidenceRows: async () => 0
}));

vi.mock('@/lib/telegram', () => ({
  pushAlertNotification: async () => undefined,
  dispatchAlertTelegram: async () => 'SKIPPED'
}));

vi.mock('@/lib/audit', async () => {
  const { createHash } = await import('crypto');
  return {
    logAudit: async () => undefined,
    computeChainHash: (prev: string, row: Record<string, string>) =>
      createHash('sha256').update(`${prev}::${JSON.stringify(row)}`).digest('hex')
  };
});

// ── Imports under test (after mocks) ──────────────────────────────
import { POST as rcvPOST } from '@/app/api/warehouse/receiving/route';
import {
  upsertBatchStockOnReceipt,
  batchStatusFromExpiry
} from '@/lib/stock-ledger';

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  });
}

const ctx = { params: Promise.resolve({}) };

const rcvBody = {
  supplier_id: 'SUP-1',
  destination_location_id: 'LOC-1',
  photo_attachment_id: 'ATT-1',
  items: [
    {
      item_id: 'ITM-1',
      batch_number: 'BATCH-001',
      expiry_date: '2099-12-31',
      qty_ordered: 100,
      qty_delivered: 100,
      qty_accepted: 100,
      unit: 'kg',
      unit_price: 50000
    }
  ]
};

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  tabRows('warehouse_attachments').push({
    attachment_id: 'ATT-1', entity_type: 'receiving', entity_id: '',
    file_id: 'F1', file_name: 'scale.jpg', mime_type: 'image/jpeg',
    size_bytes: '1000', uploaded_by: 'USR-001', created_at: ''
  });
});

describe('receiving route updates batch_stock', () => {
  it('inserts a batch_stock row on a receipt with a new batch', async () => {
    const res = await rcvPOST(req(rcvBody), ctx);
    expect(res.status).toBe(201);

    const batches = tabRows('warehouse_batch_stock');
    expect(batches).toHaveLength(1);
    const b = batches[0];
    expect(b.item_id).toBe('ITM-1');
    expect(b.location_id).toBe('LOC-1');
    expect(b.batch_number).toBe('BATCH-001');
    expect(b.expiry_date).toBe('2099-12-31');
    expect(b.current_qty).toBe('100');
    expect(b.unit).toBe('kg');
    expect(b.unit_cost).toBe('50000');
    expect(b.status).toBe('ACTIVE');
  });

  it('increments current_qty on a second receipt for the same batch (no dup row)', async () => {
    await rcvPOST(req(rcvBody), ctx);
    await rcvPOST(req(rcvBody), ctx);

    const batches = tabRows('warehouse_batch_stock');
    expect(batches).toHaveLength(1);
    expect(Number(batches[0].current_qty)).toBe(200);
  });

  it('does NOT touch batch_stock when batch_number is absent', async () => {
    const noBatch = {
      ...rcvBody,
      items: [{ ...rcvBody.items[0], batch_number: undefined }]
    };
    const res = await rcvPOST(req(noBatch), ctx);
    expect(res.status).toBe(201);
    expect(tabRows('warehouse_batch_stock')).toHaveLength(0);
  });
});

describe('upsertBatchStockOnReceipt (pure helper)', () => {
  it('creates a new batch row', async () => {
    const { row, created } = await upsertBatchStockOnReceipt({
      itemId: 'ITM-A', locationId: 'LOC-A', batchNumber: 'B-1',
      expiryDate: '2099-12-31', qtyAccepted: 5, unit: 'kg', unitCost: 1000
    });
    expect(created).toBe(true);
    expect(row.current_qty).toBe('5');
    expect(row.status).toBe('ACTIVE');
  });

  it('increments an existing batch row and recomputes status', async () => {
    await upsertBatchStockOnReceipt({
      itemId: 'ITM-A', locationId: 'LOC-A', batchNumber: 'B-1',
      expiryDate: '2099-12-31', qtyAccepted: 5, unit: 'kg', unitCost: 1000
    });
    const { row, created } = await upsertBatchStockOnReceipt({
      itemId: 'ITM-A', locationId: 'LOC-A', batchNumber: 'B-1',
      expiryDate: '2099-12-31', qtyAccepted: 3, unit: 'kg', unitCost: 1000
    });
    expect(created).toBe(false);
    expect(row.current_qty).toBe('8');
    expect(row.batch_stock_id).toMatch(/^BAT-/);
  });

  it('rejects when identifying fields are missing', async () => {
    await expect(upsertBatchStockOnReceipt({
      itemId: '', locationId: 'LOC-A', batchNumber: 'B-1',
      qtyAccepted: 1, unit: 'kg', unitCost: 0
    })).rejects.toThrow();
  });
});

describe('batchStatusFromExpiry', () => {
  it('ACTIVE when expiry far in the future', () => {
    expect(batchStatusFromExpiry('2026-08-21', '2099-12-31', 10)).toBe('ACTIVE');
  });
  it('NEAR_EXPIRY within 7 days', () => {
    expect(batchStatusFromExpiry('2026-08-21', '2026-08-27', 10)).toBe('NEAR_EXPIRY');
  });
  it('EXPIRED past the date', () => {
    expect(batchStatusFromExpiry('2026-08-21', '2026-08-20', 10)).toBe('EXPIRED');
  });
  it('DEPLETED when qty <= 0 regardless of date', () => {
    expect(batchStatusFromExpiry('2026-08-21', '2099-12-31', 0)).toBe('DEPLETED');
    expect(batchStatusFromExpiry('2026-08-21', '2099-12-31', -5)).toBe('DEPLETED');
  });
  it('ACTIVE when no expiry date', () => {
    expect(batchStatusFromExpiry('2026-08-21', '', 10)).toBe('ACTIVE');
  });
});