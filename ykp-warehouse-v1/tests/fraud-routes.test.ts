/**
 * Route-level fraud-control tests — mocked Sheets layer.
 *
 * Exercises the REAL route handlers (adjustment + receiving) against an
 * in-memory fake of @/db/sheets, verifying the P0 anti-fraud wiring:
 *
 *  1. Adjustment POST ignores client-supplied approved_by (was the
 *     self-approval stock-manipulation hole).
 *  2. Adjustment POST requires a real reason.
 *  3. Adjustment PUT blocks requester approving own record (SoD).
 *  4. Receiving POST requires 2-person verification on variance (3-way gate).
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

// ── Session + repo fakes ──────────────────────────────────────────
const session = { userId: 'USR-001', role: 'owner', username: 'owner' };
vi.mock('@/lib/session', () => ({
  getSession: async () => session
}));

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

vi.mock('@/lib/stock-ledger', () => ({
  appendMovement: async () => ({ movement_id: 'MOV-1' })
}));

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
import { POST as adjPOST, PUT as adjPUT } from '@/app/api/warehouse/adjustment/route';
import { POST as rcvPOST } from '@/app/api/warehouse/receiving/route';

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  });
}

// Route handlers wrapped by `handler` expect (req, ctx) with ctx.params a Promise.
const ctx = { params: Promise.resolve({}) };

const adjBody = {
  item_id: 'ITM-1', location_id: 'LOC-1', adjustment_type: 'COUNT_CORRECTION',
  qty_difference: '5', reason: 'Recount setelah opname'
};

const rcvBody = {
  supplier_id: 'SUP-1', destination_location_id: 'LOC-1',
  photo_attachment_id: 'ATT-1',
  items: [{ item_id: 'ITM-1', qty_ordered: 100, qty_delivered: 90, qty_accepted: 90, unit: 'kg', unit_price: 50000 }]
};

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  tabRows('warehouse_attachments').push({ attachment_id: 'ATT-1', entity_type: 'receiving', entity_id: '', file_id: 'F1', file_name: 'scale.jpg', mime_type: 'image/jpeg', size_bytes: '1000', uploaded_by: 'USR-001', created_at: '' });
});

describe('adjustment route fraud controls', () => {
  it('POST ignores client-supplied approved_by (self-approval hole closed)', async () => {
    const res = await adjPOST(req({ ...adjBody, approved_by: 'USR-001' }), ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.approval_status).toBe('PENDING');
    expect(json.data.approved_by).toBe('');
    // and NO ledger movement was posted (status is PENDING, not APPROVED)
  });

  it('POST rejects short reason', async () => {
    const res = await adjPOST(req({ ...adjBody, reason: 'x' }), ctx);
    expect(res.status).toBe(400);
  });

  it('PUT blocks requester approving own adjustment (SoD)', async () => {
    // seed a PENDING adjustment requested by USR-001 (the session user)
    tabRows('warehouse_stock_adjustment').push({
      adjustment_id: 'ADJ-1', date: '2026-07-18', item_id: 'ITM-1', location_id: 'LOC-1',
      adjustment_type: 'COUNT_CORRECTION', qty_difference: '5', unit: 'kg',
      reason: 'Recount', reference_count_id: '', requested_by: 'USR-001',
      approved_by: '', approval_status: 'PENDING', created_at: ''
    });
    const res = await adjPUT(req({ adjustment_id: 'ADJ-1', approved: true }), ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(JSON.stringify(json)).toContain('Segregation of duties');
  });

  it('PUT allows a DIFFERENT approver', async () => {
    tabRows('warehouse_stock_adjustment').push({
      adjustment_id: 'ADJ-2', date: '2026-07-18', item_id: 'ITM-1', location_id: 'LOC-1',
      adjustment_type: 'COUNT_CORRECTION', qty_difference: '5', unit: 'kg',
      reason: 'Recount', reference_count_id: '', requested_by: 'USR-002',
      approved_by: '', approval_status: 'PENDING', created_at: ''
    });
    const res = await adjPUT(req({ adjustment_id: 'ADJ-2', approved: true }), ctx);
    expect(res.status).toBe(200);
  });
});

describe('receiving route 3-way gate', () => {
  it('blocks variance >2% without a second-person verifier', async () => {
    const res = await rcvPOST(req(rcvBody), ctx); // 90 vs 100 = -10%
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(JSON.stringify(json)).toContain('verifikasi orang kedua');
  });

  it('blocks verifier = receiver (TTD 2 orang)', async () => {
    const res = await rcvPOST(req({ ...rcvBody, received_by: 'USR-001', verified_by: 'USR-001' }), ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(JSON.stringify(json)).toContain('berbeda');
  });

  it('accepts variance with a distinct verifier and escalates severity', async () => {
    const res = await rcvPOST(req({ ...rcvBody, received_by: 'USR-001', verified_by: 'USR-002' }), ctx);
    expect(res.status).toBe(201);
    // variance -10% → CRITICAL alert row created
    const alerts = tabRows('warehouse_alert_log');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].severity).toBe('CRITICAL');
    // receiving marked DISCREPANCY
    const headers = tabRows('warehouse_receiving');
    expect(headers[0].receiving_status).toBe('DISCREPANCY');
    // variance_pct persisted on the receiving item
    const items = tabRows('warehouse_receiving_item');
    expect(Number(items[0].variance_pct)).toBeCloseTo(-10, 1);
  });

  it('passes clean receiving without verifier', async () => {
    const clean = {
      ...rcvBody,
      items: [{ item_id: 'ITM-1', qty_ordered: 100, qty_delivered: 100, qty_accepted: 100, unit: 'kg', unit_price: 50000 }]
    };
    const res = await rcvPOST(req(clean), ctx);
    expect(res.status).toBe(201);
    expect(tabRows('warehouse_alert_log')).toHaveLength(0);
  });

  it('scale_weight disagreement triggers CRITICAL even when invoice matches', async () => {
    const body = {
      ...rcvBody,
      received_by: 'USR-001', verified_by: 'USR-002',
      items: [{ item_id: 'ITM-1', qty_ordered: 100, qty_delivered: 100, qty_accepted: 100, scale_weight: 90, unit: 'kg', unit_price: 50000 }]
    };
    const res = await rcvPOST(req(body), ctx);
    expect(res.status).toBe(201);
    const alerts = tabRows('warehouse_alert_log');
    expect(alerts[0].severity).toBe('CRITICAL');
    expect(tabRows('warehouse_receiving_item')[0].scale_weight).toBe('90');
  });
});
