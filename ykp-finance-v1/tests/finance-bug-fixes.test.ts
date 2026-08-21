/**
 * Finance bug-fix proofs — mocked Sheets layer.
 *
 * Covers the fixes from DEEP-BUG-RESEARCH-2.md finance section that need a
 * route/engine-level assertion:
 *   - Bug #1: audit redaction uses snake_case columns (PII stripped on GET).
 *   - Bug #2/#9: approve-payment pay path is guarded (409 on concurrent pay)
 *     and rejects a petty-cash pay that would drive running_balance negative.
 *   - Bug #3: supplier PATCH add_payment is guarded (409 on concurrent edit).
 *   - Bug #4: closing-cash opening_cash "Rp 500.000" parses to 500000 (no NaN).
 *   - Bug #5: expense PATCH amount "Rp 1.000.000" normalizes to 1000000.
 *   - Bug #7: petty-cash POST enforces per-account daily_limit.
 *   - Bug #8: petty-cash POST allows debit==0&&credit==0 with physical_cash.
 *   - Bug #13: settings telegram_owner_chat_id rejected for finance_admin.
 *   - Bug #14: alerts/actions public GET redacts assignment fields.
 *
 * Bug #6 (petty_id tiebreak), #10 (moka importer), #11 (daily-brief), #12
 * (consumeLinkCode) are covered by the updated moka-importer.test.ts and by
 * the concurrency guard's existing tests; this file focuses on route behavior.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ── In-memory Sheets fake ─────────────────────────────────────────
interface FakeTab { rows: Record<string, string>[] }
const db: Record<string, FakeTab> = {};

function tabRows(tab: string): Record<string, string>[] {
  return (db[tab] ??= { rows: [] }).rows;
}

// Per-(tab,col,val) findRow call counter for guard-race simulation.
const findCallCounts: Record<string, number> = {};
const findOverrides: Record<string, Record<string, string>> = {};

function findKey(tab: string, col: string, val: string): string {
  return `${tab}|${col}|${val}`;
}

vi.mock('@/db/sheets', async () => {
  const TABS = {
    expense: 'fin_expense',
    supplierCost: 'fin_supplier_cost',
    pettyCash: 'fin_petty_cash',
    pettyCashAccounts: 'fin_petty_cash_account',
    closingCash: 'fin_closing_cash',
    outlets: 'master_outlet',
    brands: 'master_brand',
    paymentMethods: 'fin_payment_method',
    posDaily: 'fin_pos_daily',
    auditLog: 'audit_log',
    alertLog: 'finance_alert_log',
    actionTracker: 'finance_action_tracker',
    appSettings: 'app_settings',
    users: 'users',
    telegramLinkCodes: 'telegram_link_codes',
    telegramDeliveryLog: 'telegram_delivery_log',
    dailySummary: 'fin_daily_summary'
  } as const;
  return {
    TABS,
    findRow: async (tab: string, col: string, val: string) => {
      const key = findKey(tab, col, val);
      const idx = findCallCounts[key] ?? 0;
      findCallCounts[key] = idx + 1;
      const overrideKey = `${key}|${idx}`;
      if (findOverrides[overrideKey]) {
        return { row: findOverrides[overrideKey], rowNumber: tabRows(tab).length + 2 };
      }
      const rows = tabRows(tab);
      const i = rows.findIndex((r) => r[col] === val);
      return i >= 0 ? { row: { ...rows[i] }, rowNumber: i + 2 } : null;
    },
    updateRow: async (tab: string, rowNumber: number, row: Record<string, string>) => {
      tabRows(tab)[rowNumber - 2] = row;
    },
    readTab: async (tab: string) => tabRows(tab).map((r) => ({ ...r })),
    appendRows: async (tab: string, rows: Record<string, string>[]) => {
      tabRows(tab).push(...rows.map((r) => ({ ...r })));
      return 2;
    }
  };
});

let sessionUser: { userId: string; role: string } | null = { userId: 'USR-002', role: 'finance_admin' };
vi.mock('@/lib/session', () => ({
  getSession: async () => (sessionUser === null ? null : { userId: sessionUser.userId, role: sessionUser.role, brandId: '', outletId: '' })
}));

vi.mock('@/lib/audit', () => ({
  logAudit: async () => undefined
}));

// ── Imports under test (after mocks) ───────────────────────────────
import { POST as approvePayment } from '@/app/api/finance/suppliers/[id]/approve-payment/route';
import { PATCH as patchSupplier } from '@/app/api/finance/suppliers/[id]/route';
import { POST as postClosingCash } from '@/app/api/finance/closing-cash/route';
import { PATCH as patchExpense } from '@/app/api/finance/expenses/[id]/route';
import { POST as postPettyCash } from '@/app/api/finance/petty-cash/route';
import { POST as postSettings } from '@/app/api/finance/settings/route';
import { GET as getAlerts } from '@/app/api/finance/alerts/route';
import { GET as getActions } from '@/app/api/finance/actions/route';

function req(body: unknown, url = 'http://localhost'): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  });
}
function patchReq(body: unknown, url: string): NextRequest {
  return new NextRequest(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
// Context for routes without a dynamic [id] segment. The handler wrapper
// (lib/http.ts) always awaits ctx.params, so a plain GET must still pass one.
const noCtx = () => ({ params: Promise.resolve({}) });

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  for (const k of Object.keys(findCallCounts)) delete findCallCounts[k];
  for (const k of Object.keys(findOverrides)) delete findOverrides[k];
  sessionUser = { userId: 'USR-002', role: 'finance_admin' };
});

function seedSupplier(over: Partial<Record<string, string>> = {}): void {
  tabRows('fin_supplier_cost').length = 0;
  tabRows('fin_supplier_cost').push({
    costing_id: 'SC-1', date_order: '2026-08-21',
    brand_id: 'BR-1', brand_name: 'Brand', outlet_id: 'OL-1', outlet_name: 'Outlet',
    supplier_id: 'SUP-1', supplier_name: 'Supplier', description: 'inv', category: 'Supplier',
    qty: '1', unit: 'unit', unit_price: '500000', total_amount: '500000',
    paid_amount: '0', unpaid_amount: '500000', payment_status: 'UNPAID', due_date: '',
    bank_account: '', invoice_number: 'INV-1', invoice_url: '', receipt_url: '',
    approval_status: 'PENDING', approved_by: '', payment_date: '', payment_ref: '', notes: '',
    source_module: '', source_transaction_id: '', payment_source: '',
    linked_expense_id: '', linked_petty_cash_id: '',
    created_by: 'USR-001', created_at: '2026-08-21 10:00:00', updated_at: '2026-08-21 10:00:00',
    ...over
  });
}

function seedPettyAccount(over: Partial<Record<string, string>> = {}): void {
  tabRows('fin_petty_cash_account').length = 0;
  tabRows('fin_petty_cash_account').push({
    account_id: 'PCA-1', outlet_id: 'OL-1', brand_id: 'BR-1', account_name: 'Kas Kecil',
    opening_balance: '1000000', daily_limit: '1500000', currency: 'IDR', status: 'ACTIVE',
    created_at: '2026-08-01 00:00:00', ...over
  });
  tabRows('master_outlet').length = 0;
  tabRows('master_outlet').push({ outlet_id: 'OL-1', brand_id: 'BR-1', outlet_name: 'Outlet', outlet_code: '', address: '', status: 'ACTIVE', created_at: '', updated_at: '' });
  tabRows('master_brand').length = 0;
  tabRows('master_brand').push({ brand_id: 'BR-1', brand_name: 'Brand', brand_code: '', status: 'ACTIVE', created_at: '', updated_at: '' });
}

// ── Bug #2: approve-payment guarded (409 on concurrent pay) ──
describe('Bug #2 approve-payment pay guardedUpdateRow', () => {
  it('returns 409 when a concurrent pay bumped updated_at before this write', async () => {
    seedSupplier({ approval_status: 'APPROVED', updated_at: 'v1' });
    // Route initial read (call 0) reads v1; guard re-read (call 1) returns v2.
    const key = `${findKey('fin_supplier_cost', 'costing_id', 'SC-1')}|1`;
    findOverrides[key] = { ...tabRows('fin_supplier_cost')[0], updated_at: 'v2', paid_amount: '250000', unpaid_amount: '250000' };
    const res = await approvePayment(req({ action: 'pay', paid_amount: '250000' }, 'http://localhost/api/finance/suppliers/SC-1/approve-payment'), ctx('SC-1'));
    expect(res.status).toBe(409);
    expect(tabRows('fin_supplier_cost')[0].paid_amount).toBe('0');
  });

  it('a single pay with no concurrent write succeeds (200)', async () => {
    seedSupplier({ approval_status: 'APPROVED', updated_at: 'v1' });
    const res = await approvePayment(req({ action: 'pay', paid_amount: '250000' }, 'http://localhost/api/finance/suppliers/SC-1/approve-payment'), ctx('SC-1'));
    expect(res.status).toBe(200);
    expect(tabRows('fin_supplier_cost')[0].paid_amount).toBe('250000');
  });
});

// ── Bug #9: petty-cash pay rejects insufficient balance ──
describe('Bug #9 approve-payment petty-cash balance + daily_limit', () => {
  it('rejects a petty-cash pay that would drive running_balance negative', async () => {
    seedSupplier({ approval_status: 'APPROVED', unpaid_amount: '2000000', total_amount: '2000000', updated_at: 'v1' });
    seedPettyAccount({ opening_balance: '500000', daily_limit: '5000000' });
    const res = await approvePayment(req({ action: 'pay', payment_source: 'petty_cash', petty_account_id: 'PCA-1' }, 'http://localhost/api/finance/suppliers/SC-1/approve-payment'), ctx('SC-1'));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('Saldo kas kecil tidak cukup');
  });

  it('rejects a petty-cash pay exceeding daily_limit', async () => {
    seedSupplier({ approval_status: 'APPROVED', unpaid_amount: '200000', total_amount: '200000', updated_at: 'v1' });
    seedPettyAccount({ opening_balance: '5000000', daily_limit: '150000' });
    const res = await approvePayment(req({ action: 'pay', payment_source: 'petty_cash', petty_account_id: 'PCA-1' }, 'http://localhost/api/finance/suppliers/SC-1/approve-payment'), ctx('SC-1'));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('daily_limit');
  });
});

// ── Bug #3: supplier PATCH add_payment guarded ──
describe('Bug #3 supplier PATCH add_payment guardedUpdateRow', () => {
  it('returns 409 when a concurrent edit bumped updated_at before the write', async () => {
    seedSupplier({ updated_at: 'v1' });
    const key = `${findKey('fin_supplier_cost', 'costing_id', 'SC-1')}|1`;
    findOverrides[key] = { ...tabRows('fin_supplier_cost')[0], updated_at: 'v2', paid_amount: '250000' };
    const res = await patchSupplier(patchReq({ add_payment: '100000' }, 'http://localhost/api/finance/suppliers/SC-1'), ctx('SC-1'));
    expect(res.status).toBe(409);
    // losing write does not overwrite the backing row (override was a synthetic
    // findRow return, not a persisted write); paid_amount stays at the seeded '0'.
    expect(tabRows('fin_supplier_cost')[0].paid_amount).toBe('0');
  });

  it('a single PATCH add_payment succeeds', async () => {
    seedSupplier({ updated_at: 'v1' });
    const res = await patchSupplier(patchReq({ add_payment: '100000' }, 'http://localhost/api/finance/suppliers/SC-1'), ctx('SC-1'));
    expect(res.status).toBe(200);
    expect(tabRows('fin_supplier_cost')[0].paid_amount).toBe('100000');
  });
});

// ── Bug #4: closing-cash opening_cash parses Rp format ──
describe('Bug #4 closing-cash opening_cash parseIdr', () => {
  beforeEach(() => {
    tabRows('master_outlet').length = 0;
    tabRows('master_outlet').push({ outlet_id: 'OL-1', brand_id: 'BR-1', outlet_name: 'O', outlet_code: '', address: '', status: 'ACTIVE', created_at: '', updated_at: '' });
    tabRows('fin_payment_method').length = 0;
    tabRows('fin_payment_method').push({ method_id: 'PM-CASH', method_name: 'Cash', type: 'cash', is_cash: 'true', status: 'ACTIVE', created_at: '' });
  });
  it('parses "Rp 500.000" to 500000 (no NaN)', async () => {
    const res = await postClosingCash(req({ date: '2026-08-21', outlet_id: 'OL-1', opening_cash: 'Rp 500.000', physical_cash: '500000' }, 'http://localhost/api/finance/closing-cash'), noCtx());
    expect(res.status).toBe(201);
    const row = tabRows('fin_closing_cash')[0];
    expect(row.opening_cash).toBe('500000');
    expect(row.expected_cash).not.toBe('NaN');
    expect(row.cash_difference).not.toBe('NaN');
  });
  it('rejects non-numeric opening_cash', async () => {
    const res = await postClosingCash(req({ date: '2026-08-21', outlet_id: 'OL-1', opening_cash: 'abc', physical_cash: '500000' }, 'http://localhost/api/finance/closing-cash'), noCtx());
    expect(res.status).toBe(400);
  });
});

// ── Bug #5: expense PATCH amount normalizes IDR ──
describe('Bug #5 expense PATCH amount normalize', () => {
  function seedExpense(over: Partial<Record<string, string>> = {}): void {
    tabRows('fin_expense').length = 0;
    tabRows('fin_expense').push({
      expense_id: 'EXP-1', date: '2026-08-21', brand_id: 'BR-1', brand_name: 'Brand',
      outlet_id: 'OL-1', outlet_name: 'Outlet', expense_category: 'OPS', description: 't',
      amount: '300000', payment_method: 'CASH', receipt_url: '', approval_status: 'APPROVED',
      approved_by: 'USR-002', status: 'ACTIVE', notes: '', source_module: '', source_transaction_id: '',
      payment_source: '', linked_supplier_invoice_id: '', linked_petty_cash_id: '',
      created_by: 'USR-001', created_at: '2026-08-21 10:00:00', updated_at: 'v1', ...over
    });
  }
  it('normalizes "Rp 1.000.000" to 1000000', async () => {
    seedExpense();
    const res = await patchExpense(patchReq({ amount: 'Rp 1.000.000' }, 'http://localhost/api/finance/expenses/EXP-1'), ctx('EXP-1'));
    expect(res.status).toBe(200);
    expect(tabRows('fin_expense')[0].amount).toBe('1000000');
  });
  it('rejects NaN amount', async () => {
    seedExpense();
    const res = await patchExpense(patchReq({ amount: 'abc' }, 'http://localhost/api/finance/expenses/EXP-1'), ctx('EXP-1'));
    expect(res.status).toBe(400);
  });
});

// ── Bug #7: petty-cash POST enforces daily_limit ──
describe('Bug #7 petty-cash daily_limit', () => {
  it('rejects credit exceeding daily_limit', async () => {
    seedPettyAccount({ opening_balance: '5000000', daily_limit: '200000' });
    const res = await postPettyCash(req({ date: '2026-08-21', account_id: 'PCA-1', credit_out: '500000', description: 'beli' }, 'http://localhost/api/finance/petty-cash'), noCtx());
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('daily_limit');
  });
  it('accepts credit within daily_limit', async () => {
    seedPettyAccount({ opening_balance: '5000000', daily_limit: '1000000' });
    const res = await postPettyCash(req({ date: '2026-08-21', account_id: 'PCA-1', credit_out: '500000', description: 'beli' }, 'http://localhost/api/finance/petty-cash'), noCtx());
    expect(res.status).toBe(201);
  });
});

// ── Bug #8: petty-cash allows closing row with physical_cash ──
describe('Bug #8 petty-cash closing row with physical_cash', () => {
  it('accepts debit==0 && credit==0 with physical_cash', async () => {
    seedPettyAccount();
    const res = await postPettyCash(req({ date: '2026-08-21', account_id: 'PCA-1', debit_topup: '0', credit_out: '0', physical_cash: '500000', description: 'closing' }, 'http://localhost/api/finance/petty-cash'), noCtx());
    expect(res.status).toBe(201);
    const row = tabRows('fin_petty_cash')[0];
    expect(row.physical_cash).toBe('500000');
  });
  it('rejects debit==0 && credit==0 without physical_cash', async () => {
    seedPettyAccount();
    const res = await postPettyCash(req({ date: '2026-08-21', account_id: 'PCA-1', debit_topup: '0', credit_out: '0', description: 'x' }, 'http://localhost/api/finance/petty-cash'), noCtx());
    expect(res.status).toBe(400);
  });
});

// ── Bug #13: settings telegram_owner_chat_id role restriction ──
describe('Bug #13 settings telegram_owner_chat_id restriction', () => {
  it('rejects finance_admin changing telegram_owner_chat_id', async () => {
    sessionUser = { userId: 'USR-FA', role: 'finance_admin' };
    const res = await postSettings(req({ key: 'telegram_owner_chat_id', value: '12345' }, 'http://localhost/api/finance/settings'), noCtx());
    expect(res.status).toBe(403);
  });
  it('allows owner changing telegram_owner_chat_id', async () => {
    sessionUser = { userId: 'USR-OWN', role: 'owner' };
    const res = await postSettings(req({ key: 'telegram_owner_chat_id', value: '12345' }, 'http://localhost/api/finance/settings'), noCtx());
    expect(res.status).toBe(200);
  });
});

// ── Bug #14: alerts/actions public GET redacts fields ──
describe('Bug #14 alerts/actions public GET redaction', () => {
  it('alerts GET redacts assigned_to/action_taken/resolved_at for unauthenticated callers', async () => {
    sessionUser = null;
    tabRows('finance_alert_log').length = 0;
    tabRows('finance_alert_log').push({
      alert_id: 'ALR-1', date: '2026-08-21', brand_id: '', brand: '', outlet_id: '', outlet: '',
      source_app: 'finance', alert_type: 'CASH_DIFFERENCE', severity: 'HIGH', title: 't', message: 'm',
      status: 'OPEN', assigned_to: 'USR-SECRET', action_taken: 'investigate', reference_type: '',
      reference_id: '', created_at: '', resolved_at: '2026-08-21 12:00:00'
    });
    const res = await getAlerts(new NextRequest('http://localhost/api/finance/alerts'), noCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items[0].assigned_to).toBe('[REDACTED]');
    expect(json.data.items[0].action_taken).toBe('[REDACTED]');
    expect(json.data.items[0].resolved_at).toBe('[REDACTED]');
  });

  it('actions GET redacts assigned_to/action_taken for unauthenticated callers', async () => {
    sessionUser = null;
    tabRows('finance_action_tracker').length = 0;
    tabRows('finance_action_tracker').push({
      action_id: 'ACT-1', source_alert_id: '', title: 't', description: '', brand_id: '', brand: '',
      outlet_id: '', outlet: '', priority: 'HIGH', assigned_to: 'USR-SECRET', assigned_role: '',
      due_date: '', status: 'OPEN', action_taken: 'follow up', created_at: '2026-08-21 10:00:00',
      updated_at: '', completed_at: ''
    });
    const res = await getActions(new NextRequest('http://localhost/api/finance/actions'), noCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items[0].assigned_to).toBe('[REDACTED]');
    expect(json.data.items[0].action_taken).toBe('[REDACTED]');
  });
});

// ── Bug #1: audit redaction snake_case ──
describe('Bug #1 audit redaction snake_case', () => {
  it('GET /api/finance/audit strips before_value/after_value', async () => {
    tabRows('audit_log').length = 0;
    tabRows('audit_log').push({
      audit_id: 'AUD-1', module: 'finance', action: 'update', record_type: 'fin_expense',
      record_id: 'EXP-1', before_value: 'SECRET-BEFORE', after_value: 'SECRET-AFTER',
      reason: '', user_id: 'USR-1', approval_user_id: '', environment: 'TESTING',
      ip_address: '', created_at: '2026-08-21 10:00:00'
    });
    const { GET } = await import('@/app/api/finance/audit/route');
    const res = await GET(new NextRequest('http://localhost/api/finance/audit'), noCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items[0].before_value).toBeUndefined();
    expect(json.data.items[0].after_value).toBeUndefined();
  });
});