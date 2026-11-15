/**
 * Staff write guard — warehouse.
 *
 * The UI hides create/action buttons when the role lacks permission, and the
 * API must enforce the same policy so a hidden button cannot be bypassed by a
 * direct request. Staff used to see the forms and fail with a confusing 401.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const db: Record<string, Record<string, string>[]> = {};

vi.mock('@/db/sheets', () => {
  const TABS = {
    waste: 'warehouse_waste',
    legacyPemakaian: 'warehouse_legacy_pemakaian',
    legacyClosing: 'warehouse_legacy_closing',
    items: 'master_item',
    locations: 'master_location',
    stockMovement: 'warehouse_stock_movement',
    alertLog: 'warehouse_alert_log',
    actionTracker: 'warehouse_action_tracker',
    auditLog: 'system_audit_log',
    evidenceLog: 'warehouse_evidence_log',
    receiving: 'warehouse_receiving',
    receivingItem: 'warehouse_receiving_item',
    suppliers: 'master_supplier',
    unitConversion: 'master_unit_conversion',
    batchStock: 'warehouse_batch_stock',
  };
  return {
    TABS,
    readTab: async (tab: string) => (db[tab] ??= []),
    appendRows: async (tab: string, rows: Record<string, string>[]) => {
      (db[tab] ??= []).push(...rows);
      return 2;
    },
    findRow: async (tab: string, col: string, val: string) => {
      const rows = db[tab] ?? [];
      const idx = rows.findIndex((r) => r[col] === val);
      return idx >= 0 ? { row: rows[idx], rowNumber: idx + 2 } : null;
    },
    updateRow: async () => undefined,
  };
});

const session = { userId: 'USR-001', role: 'owner', username: 'owner' };
vi.mock('@/lib/session', () => ({ getSession: async () => session }));
vi.mock('@/lib/audit', () => ({ logAudit: async () => undefined }));
vi.mock('@/lib/format', () => ({
  nowTimestampWib: () => '2026-11-15 08:00:00',
  formatDateWib: () => '2026-11-15',
  formatTimeWib: () => '08:00',
}));
vi.mock('@/lib/repo', () => {
  let n = 0;
  return {
    nextSequentialIdSync: (p: string) => `${p}-T${++n}`,
    MissingRefError: class MissingRefError extends Error {},
    assertItem: async () => true,
    assertLocation: async () => true,
    assertSupplier: async () => true,
  };
});
vi.mock('@/lib/evidence', () => ({
  appendEvidenceRows: async () => undefined,
  parseEvidenceUrls: () => [],
}));
vi.mock('@/lib/legacy', () => ({
  legacyWritesEnabled: () => true,
  legacyWritesDisabledResponse: () =>
    new Response(JSON.stringify({ error: { code: 'gone', message: 'gone' } }), { status: 410 }),
}));
vi.mock('@/lib/fraud-controls', () => ({
  FraudControlError: class FraudControlError extends Error {},
  assertReason: () => undefined,
  assertReceivingVerification: () => undefined,
  checkReceivingThreeWay: () => ({ severity: 'OK', pctVsOrdered: 0 }),
}));
vi.mock('@/lib/stock-ledger', () => ({ appendMovement: async () => undefined }));
vi.mock('@/lib/rules-engine', () => ({
  evalReceivingDiscrepancy: () => ({ severity: 'OK' }),
  shouldCreateAction: () => false,
  evalNearExpiry: () => null,
}));
vi.mock('@/lib/telegram', () => ({ dispatchAlertTelegram: async () => undefined }));

const { POST: wastePost } = await import('@/app/api/warehouse/waste/route');
const { POST: pemakaianPost } = await import('@/app/api/warehouse/pemakaian/route');
const { POST: closingPost } = await import('@/app/api/warehouse/closing/route');
const { POST: receivingPost } = await import('@/app/api/warehouse/receiving/route');

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({}) };

beforeEach(() => {
  for (const key of Object.keys(db)) delete db[key];
  session.role = 'owner';
});

describe('warehouse write endpoints enforce RBAC, not just the UI', () => {
  it('waste rejects staff', async () => {
    session.role = 'staff';
    const res = await wastePost(post({ outlet_id: 'OL-011', item_id: 'ITM-1', qty: '1', photo_url: 'x' }), params);
    expect(res.status).toBe(403);
  });

  it('bon pemakaian rejects staff', async () => {
    session.role = 'staff';
    const res = await pemakaianPost(post({ outlet_id: 'OL-011', item_id: 'ITM-1', qty_out: '1' }), params);
    expect(res.status).toBe(403);
  });

  it('daily closing rejects staff', async () => {
    session.role = 'staff';
    const res = await closingPost(post({ outlet_id: 'OL-011', item_id: 'ITM-1', actual_stock: '1' }), params);
    expect(res.status).toBe(403);
  });

  it('receiving rejects staff', async () => {
    session.role = 'staff';
    const res = await receivingPost(
      post({ destination_location_id: 'LOC-1', items: [{ item_id: 'ITM-1', qty_delivered: 1, unit: 'kg', unit_price: 1 }] }),
      params,
    );
    expect(res.status).toBe(403);
  });

  it('owner still passes the guard', async () => {
    const res = await pemakaianPost(post({ outlet_id: 'OL-011', item_id: 'ITM-1', qty_out: '1' }), params);
    expect(res.status).not.toBe(403);
  });
});
