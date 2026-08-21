/**
 * Deep Bug Research 2 — warehouse fix regression tests (mocked Sheets).
 *
 * Covers the behavior changes introduced by the 17-bug fix pass:
 *   - Bug 3: transfer dispatch/receive rejects negative/NaN qty.
 *   - Bug 4: waste posts a WASTE OUT ledger movement and rejects NaN qty.
 *   - Bug 6: transfer approve enforces SoD.
 *   - Bug 7: stock-count posts a COUNT_ADJUSTMENT movement for the variance.
 *   - Bug 8: stock-issue rejects issued_by === requested_by (SoD).
 *   - Bug 9: adjustment rejects non-finite qty_difference on POST and on approve.
 *   - Bug 10: batch-stock rejects non-finite current_qty.
 *   - Bug 11: daily-brief returns SKIPPED when today's summary is missing.
 *   - Bug 13: receiving rejects qty_accepted > qty_delivered.
 *   - Bug 14: closing flags ALERT at variance > 2% (was 5%).
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
    waste: 'warehouse_waste',
    transfer: 'warehouse_transfer',
    transferItem: 'warehouse_transfer_item',
    stockCount: 'warehouse_stock_count',
    stockCountItem: 'warehouse_stock_count_item',
    stockIssue: 'warehouse_stock_issue',
    stockIssueItem: 'warehouse_stock_issue_item',
    batchStock: 'warehouse_batch_stock',
    closing: 'f5_closing',
    dailySummary: 'warehouse_daily_summary',
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
  dispatchAlertTelegram: async () => 'SKIPPED',
  buildDailyBrief: async () => 'brief',
  collectFraudWatchData: async () => ({
    wasteToday: { count: 0, value: 0 },
    adjustmentsToday: { pending: 0, approved: 0 },
    receivingDiscrepanciesToday: 0,
    staleApprovals: 0
  }),
  composeFraudWatchBlock: () => '',
  sendTelegram: async () => ({ deliveryId: 'TDL-1', status: 'FAILED', error: 'no token' })
}));

// Capture ledger movements posted through appendMovement.
const movements: Record<string, string>[] = [];
vi.mock('@/lib/stock-ledger', async () => {
  const real = await vi.importActual<typeof import('@/lib/stock-ledger')>('@/lib/stock-ledger');
  return {
    ...real,
    appendMovement: async (p: import('@/lib/stock-ledger').MovementParams) => {
      const row = {
        movement_id: 'MV-T',
        movement_type: p.movementType,
        direction: p.direction,
        quantity: String(p.quantity),
        item_id: p.itemId,
        location_id: p.locationId,
        reference_type: p.referenceType,
        reference_id: p.referenceId,
        notes: p.notes ?? ''
      } as Record<string, string>;
      movements.push(row);
      return row as unknown as import('@/lib/stock-ledger').MovementRow;
    }
  };
});

vi.mock('@/lib/audit', async () => {
  const { createHash } = await import('crypto');
  return {
    logAudit: async () => undefined,
    computeChainHash: (prev: string, row: Record<string, string>) =>
      createHash('sha256').update(`${prev}::${JSON.stringify(row)}`).digest('hex')
  };
});

// ── Imports under test (after mocks) ──────────────────────────────
import { POST as trfPOST, PUT as trfPUT } from '@/app/api/warehouse/transfer/route';
import { POST as wstPOST } from '@/app/api/warehouse/waste/route';
import { POST as cntPOST } from '@/app/api/warehouse/stock-count/route';
import { POST as isuPOST } from '@/app/api/warehouse/stock-issue/route';
import { POST as adjPOST, PUT as adjPUT } from '@/app/api/warehouse/adjustment/route';
import { POST as batPOST } from '@/app/api/warehouse/batch-stock/route';
import { POST as rcvPOST } from '@/app/api/warehouse/receiving/route';
import { POST as closePOST } from '@/app/api/warehouse/closing/route';
import { POST as briefPOST } from '@/app/api/warehouse/notify/daily-brief/route';
import { todayWib } from '@/lib/format';
import * as legacy from '@/lib/legacy';

function req(body: unknown, method = 'POST'): NextRequest {
  return new NextRequest('http://localhost/api', {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  });
}

const ctx = { params: Promise.resolve({}) };

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  movements.length = 0;
});

// Seed a REQUESTED transfer header + one transfer item for dispatch/receive/approve.
function seedTransfer(override: Partial<Record<string, string>> = {}): void {
  tabRows('warehouse_transfer').push({
    transfer_id: 'TRF-1', transfer_number: 'TRF-1', date: '2026-08-21',
    source_location_id: 'LOC-1', destination_location_id: 'LOC-2',
    requested_by: 'USR-OTHER', approved_by: '', dispatched_by: '', received_by: '',
    dispatch_time: '', received_time: '', status: 'REQUESTED', notes: '',
    created_at: '', updated_at: '',
    ...override
  });
  tabRows('warehouse_transfer_item').push({
    transfer_item_id: 'TRI-1', transfer_id: 'TRF-1', item_id: 'ITM-1',
    requested_qty: '10', dispatched_qty: '0', received_qty: '0', unit: 'kg',
    discrepancy_qty: '0', discrepancy_reason: '', photo_url: ''
  });
}

describe('Bug 3 — transfer dispatch/receive finite qty guard', () => {
  it('dispatch rejects negative qty', async () => {
    seedTransfer({ status: 'APPROVED' });
    const res = await trfPUT(req({
      transfer_id: 'TRF-1', action: 'dispatch',
      items: [{ item_id: 'ITM-1', qty: -10 }]
    }), ctx);
    expect(res.status).toBe(400);
  });
  it('dispatch rejects NaN qty', async () => {
    seedTransfer({ status: 'APPROVED' });
    const res = await trfPUT(req({
      transfer_id: 'TRF-1', action: 'dispatch',
      items: [{ item_id: 'ITM-1', qty: 'abc' as unknown as number }]
    }), ctx);
    expect(res.status).toBe(400);
  });
  it('receive rejects negative qty', async () => {
    seedTransfer({ status: 'DISPATCHED' });
    tabRows('warehouse_transfer_item')[0].dispatched_qty = '10';
    const res = await trfPUT(req({
      transfer_id: 'TRF-1', action: 'receive',
      items: [{ item_id: 'ITM-1', qty: -5 }]
    }), ctx);
    expect(res.status).toBe(400);
  });
});

describe('Bug 4 — waste posts WASTE OUT movement + finite guard', () => {
  it('rejects non-finite qty', async () => {
    const res = await wstPOST(req({
      item_id: 'ITM-1', location_id: 'LOC-1', qty: 'abc', unit: 'kg',
      reason: 'spoilage test', photo_url: 'http://x/p.jpg',
      estimated_unit_cost: 1000
    }), ctx);
    expect(res.status).toBe(400);
  });
  it('posts a WASTE OUT ledger movement', async () => {
    const res = await wstPOST(req({
      item_id: 'ITM-1', location_id: 'LOC-1', qty: 3, unit: 'kg',
      reason: 'spoilage test', photo_url: 'http://x/p.jpg',
      estimated_unit_cost: 1000
    }), ctx);
    expect(res.status).toBe(201);
    const waste = movements.find((m) => m.movement_type === 'WASTE');
    expect(waste).toBeDefined();
    expect(waste!.direction).toBe('OUT');
    expect(waste!.quantity).toBe('3');
    expect(waste!.item_id).toBe('ITM-1');
    expect(waste!.location_id).toBe('LOC-1');
  });
});

describe('Bug 6 — transfer approve SoD', () => {
  it('blocks self-approve', async () => {
    seedTransfer({ requested_by: 'USR-001' });
    const res = await trfPUT(req({ transfer_id: 'TRF-1', action: 'approve' }), ctx);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Segregation of duties');
  });
  it('allows a different approver', async () => {
    seedTransfer({ requested_by: 'USR-OTHER' });
    const res = await trfPUT(req({ transfer_id: 'TRF-1', action: 'approve' }), ctx);
    expect(res.status).toBe(200);
  });
});

describe('Bug 7 — stock-count posts COUNT_ADJUSTMENT movement', () => {
  it('posts an adjustment movement for the variance', async () => {
    const res = await cntPOST(req({
      location_id: 'LOC-1',
      items: [{ item_id: 'ITM-1', physical_stock: 8, base_unit: 'kg' }]
    }), ctx);
    expect(res.status).toBe(201);
    const adj = movements.find((m) => m.movement_type === 'COUNT_ADJUSTMENT');
    expect(adj).toBeDefined();
    expect(adj!.direction).toBe('ADJUSTMENT');
    expect(adj!.reference_type).toBe('stock_count');
    // physical 8 - book 0 = +8
    expect(adj!.quantity).toBe('8');
  });
});

describe('Bug 8 — stock-issue SoD', () => {
  it('blocks issued_by === requested_by', async () => {
    const res = await isuPOST(req({
      source_location_id: 'LOC-1',
      requested_by: 'USR-001', issued_by: 'USR-001',
      items: [{ item_id: 'ITM-1', requested_qty: 2, issued_qty: 2, unit: 'kg' }]
    }), ctx);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Segregation of duties');
  });
  it('allows a different issuer', async () => {
    const res = await isuPOST(req({
      source_location_id: 'LOC-1',
      requested_by: 'USR-OTHER', issued_by: 'USR-001',
      items: [{ item_id: 'ITM-1', requested_qty: 2, issued_qty: 2, unit: 'kg' }]
    }), ctx);
    expect(res.status).toBe(201);
  });
});

describe('Bug 9 — adjustment finite qty guard', () => {
  const adjBody = {
    item_id: 'ITM-1', location_id: 'LOC-1', adjustment_type: 'COUNT_CORRECTION',
    qty_difference: '5', reason: 'Recount setelah opname'
  };
  it('POST rejects non-finite qty_difference', async () => {
    const res = await adjPOST(req({ ...adjBody, qty_difference: 'abc' }), ctx);
    expect(res.status).toBe(400);
  });
  it('PUT rejects approve when stored qty_difference is non-finite', async () => {
    tabRows('warehouse_stock_adjustment').push({
      adjustment_id: 'ADJ-1', date: '2026-08-21', item_id: 'ITM-1', location_id: 'LOC-1',
      adjustment_type: 'COUNT_CORRECTION', qty_difference: 'abc', unit: 'kg',
      reason: 'Recount', reference_count_id: '', requested_by: 'USR-OTHER',
      approved_by: '', approval_status: 'PENDING', created_at: ''
    });
    const res = await adjPUT(req({ adjustment_id: 'ADJ-1', approved: true }), ctx);
    expect(res.status).toBe(400);
  });
});

describe('Bug 10 — batch-stock finite current_qty guard', () => {
  it('rejects non-finite current_qty', async () => {
    const res = await batPOST(req({
      item_id: 'ITM-1', location_id: 'LOC-1', batch_number: 'B-1',
      current_qty: 'abc', unit: 'kg'
    }), ctx);
    expect(res.status).toBe(400);
  });
});

describe('Bug 11 — daily-brief SKIPPED when today missing', () => {
  it('returns SKIPPED when no summary for today', async () => {
    process.env.CRON_SECRET = 'test-cron-secret-32-chars-padded!!';
    tabRows('warehouse_daily_summary').push({
      summary_id: 'S-1', date: '2020-01-01', brand_id: '', brand_name: '',
      outlet_id: '', outlet_name: '', location_id: '', total_inventory_value: '0',
      critical_low_stock_count: '', stockout_risk_count: '',
      purchase_recommendation_count: '', estimated_purchase_value: '',
      pending_purchase_request_count: '', pending_receiving_count: '',
      receiving_discrepancy_count: '', pending_transfer_count: '',
      transfer_discrepancy_count: '', waste_item_count: '', waste_value: '',
      variance_item_count: '', unexplained_variance_value: '',
      near_expiry_item_count: '', expired_item_count: '', open_action_count: '',
      overdue_action_count: '', major_warehouse_issue: '', recommended_action: '',
      generated_at: '', value_basis: ''
    });
    const r = new NextRequest('http://localhost/api/warehouse/notify/daily-brief', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'content-type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET
      }
    });
    const res = await briefPOST(r, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('SKIPPED');
    expect(json.data.reason).toContain(todayWib());
    delete process.env.CRON_SECRET;
  });
});

describe('Bug 13 — receiving rejects qty_accepted > qty_delivered', () => {
  it('blocks over-acceptance', async () => {
    const res = await rcvPOST(req({
      supplier_id: 'SUP-1', destination_location_id: 'LOC-1',
      photo_attachment_id: 'ATT-1',
      items: [{ item_id: 'ITM-1', qty_ordered: 10, qty_delivered: 10, qty_accepted: 15, unit: 'kg', unit_price: 5000 }]
    }), ctx);
    expect(res.status).toBe(400);
  });
});

describe('Bug 14 — closing ALERT threshold 2%', () => {
  beforeEach(() => {
    vi.spyOn(legacy, 'legacyWritesEnabled').mockReturnValue(true);
  });
  it('flags ALERT at 3% variance (was 5%)', async () => {
    // expected = 100, actual = 103 → +3% → ALERT under 2% rule (was OK under 5%)
    const res = await closePOST(req({
      outlet_id: 'OUT-1', item_id: 'ITM-1', unit: 'kg',
      stock_open: '100', received: '0', used: '0', waste: '0', actual_stock: '103'
    }), ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.status).toBe('ALERT');
  });
  it('keeps OK under 2%', async () => {
    const res = await closePOST(req({
      outlet_id: 'OUT-1', item_id: 'ITM-1', unit: 'kg',
      stock_open: '100', received: '0', used: '0', waste: '0', actual_stock: '101'
    }), ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.status).toBe('OK');
  });
});