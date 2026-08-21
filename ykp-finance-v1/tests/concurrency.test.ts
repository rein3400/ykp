/**
 * Finance optimistic-concurrency guard tests — mocked Sheets layer.
 *
 * Covers three properties:
 *   1. guardedUpdateRow throws ConcurrentUpdateError when the version field
 *      changed between snapshot and re-read (pure guard).
 *   2. guardedUpdateRow writes successfully when the version is unchanged.
 *   3. The REAL expense approve route returns 409 when the row was modified
 *      between its read and its write (concurrent double-approve cannot both
 *      succeed silently).
 *
 * The route test simulates the race by pre-seeding the row, letting the first
 * approve win (mutating updated_at), then firing a second approve that still
 * holds the stale snapshot — which is exactly the observable property of a
 * lost update, and the guard must reject it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ── In-memory Sheets fake ─────────────────────────────────────────
interface FakeTab { rows: Record<string, string>[] }
const db: Record<string, FakeTab> = {};

function tabRows(tab: string): Record<string, string>[] {
  return (db[tab] ??= { rows: [] }).rows;
}

// Per-(tab,col,val) findRow call counter, so a test can make the 2nd read
// return a different row (simulating a concurrent write between the route's
// initial read and the guard's re-read).
const findCallCounts: Record<string, number> = {};
// Optional override rows keyed by `${tab}|${col}|${val}|${callIndex}` (0-based)
const findOverrides: Record<string, Record<string, string>> = {};

function findKey(tab: string, col: string, val: string): string {
  return `${tab}|${col}|${val}`;
}

vi.mock('@/db/sheets', async () => {
  const TABS = {
    expense: 'fin_expense',
    pettyCash: 'fin_petty_cash',
    auditLog: 'system_audit_log'
  } as const;
  return {
    TABS,
    findRow: async (tab: string, col: string, val: string) => {
      const key = findKey(tab, col, val);
      const idx = findCallCounts[key] ?? 0;
      findCallCounts[key] = idx + 1;
      const overrideKey = `${key}|${idx}`;
      if (findOverrides[overrideKey]) {
        const rows = tabRows(tab);
        const rowNumber = rows.length + 2; // synthetic
        return { row: findOverrides[overrideKey], rowNumber };
      }
      const rows = tabRows(tab);
      const i = rows.findIndex((r) => r[col] === val);
      return i >= 0 ? { row: rows[i], rowNumber: i + 2 } : null;
    },
    updateRow: async (tab: string, rowNumber: number, row: Record<string, string>) => {
      tabRows(tab)[rowNumber - 2] = row;
    },
    readTab: async (tab: string) => tabRows(tab),
    appendRows: async (tab: string, rows: Record<string, string>[]) => {
      tabRows(tab).push(...rows);
      return 2;
    }
  };
});

let sessionUser = { userId: 'USR-002', role: 'finance_admin' };
vi.mock('@/lib/session', () => ({
  getSession: async () => ({ userId: sessionUser.userId, role: sessionUser.role })
}));

vi.mock('@/lib/audit', async () => {
  const { createHash } = await import('crypto');
  return {
    logAudit: async () => undefined,
    computeChainHash: (prev: string, row: Record<string, string>) =>
      createHash('sha256').update(`${prev}::${JSON.stringify(row)}`).digest('hex')
  };
});

// ── Imports under test (after mocks) ───────────────────────────────
import { guardedUpdateRow, ConcurrentUpdateError } from '@/lib/concurrency';
import { POST as approveExpense } from '@/app/api/finance/expenses/[id]/approve/route';

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/finance/expenses/EXP-1/approve', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function seedExpense(over: Partial<Record<string, string>> = {}): void {
  tabRows('fin_expense').length = 0;
  tabRows('fin_expense').push({
    expense_id: 'EXP-1',
    date: '2026-08-21',
    brand_id: 'BR-1', brand_name: 'Brand',
    outlet_id: 'OL-1', outlet_name: 'Outlet',
    expense_category: 'OPS', description: 'test',
    amount: '300000', payment_method: 'CASH', receipt_url: '',
    approval_status: 'PENDING', approved_by: '',
    created_by: 'USR-001',
    created_at: '2026-08-21 10:00:00',
    updated_at: '2026-08-21 10:00:00',
    ...over
  });
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  for (const k of Object.keys(findCallCounts)) delete findCallCounts[k];
  for (const k of Object.keys(findOverrides)) delete findOverrides[k];
  sessionUser = { userId: 'USR-002', role: 'finance_admin' };
});

describe('guardedUpdateRow (pure guard)', () => {
  it('writes when the version field is unchanged', async () => {
    seedExpense({ updated_at: 'v1' });
    const snapshot = { row: { expense_id: 'EXP-1', updated_at: 'v1' }, rowNumber: 2 };
    const newRow = { expense_id: 'EXP-1', updated_at: 'v2', approval_status: 'APPROVED' };
    const n = await guardedUpdateRow('fin_expense', 'expense_id', 'EXP-1', snapshot, newRow, 'updated_at');
    expect(n).toBe(2);
    expect(tabRows('fin_expense')[0].updated_at).toBe('v2');
  });

  it('throws ConcurrentUpdateError when updated_at changed between snapshot and re-read', async () => {
    seedExpense({ updated_at: 'v2' }); // a concurrent write already bumped it
    const staleSnapshot = { row: { expense_id: 'EXP-1', updated_at: 'v1' }, rowNumber: 2 };
    const newRow = { expense_id: 'EXP-1', updated_at: 'v3', approval_status: 'APPROVED' };
    await expect(guardedUpdateRow('fin_expense', 'expense_id', 'EXP-1', staleSnapshot, newRow, 'updated_at'))
      .rejects.toBeInstanceOf(ConcurrentUpdateError);
    // and the row is NOT overwritten with v3
    expect(tabRows('fin_expense')[0].updated_at).toBe('v2');
  });

  it('throws when the row vanished between snapshot and re-read', async () => {
    const staleSnapshot = { row: { expense_id: 'GONE', updated_at: 'v1' }, rowNumber: 2 };
    await expect(guardedUpdateRow('fin_expense', 'expense_id', 'GONE', staleSnapshot, { updated_at: 'v2' }))
      .rejects.toBeInstanceOf(ConcurrentUpdateError);
  });
});

describe('expense approve route optimistic-concurrency', () => {
  it('returns 409 when a concurrent approve bumped updated_at before this write', async () => {
    // Seed PENDING with v1. The route's initial findRow (call 0) reads this.
    seedExpense({ approval_status: 'PENDING', updated_at: '2026-08-21 10:00:00' });
    // Override the guard's re-read (call 1) to return a row already bumped
    // to v2 — simulating a concurrent approve that won the race between the
    // route's initial read and the guard's re-read.
    const key = `${findKey('fin_expense', 'expense_id', 'EXP-1')}|1`;
    findOverrides[key] = {
      ...tabRows('fin_expense')[0],
      updated_at: '2026-08-21 11:00:00',
      approved_by: 'USR-999'
    };

    const res = await approveExpense(req({ action: 'approve' }), ctx('EXP-1'));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(JSON.stringify(json)).toContain('version changed');
    // The row in the backing store is NOT overwritten by the losing call.
    expect(tabRows('fin_expense')[0].approved_by).toBe('');
  });

  it('a single approve with no concurrent write succeeds (200)', async () => {
    seedExpense({ approval_status: 'PENDING', updated_at: '2026-08-21 10:00:00' });
    const res = await approveExpense(req({ action: 'approve' }), ctx('EXP-1'));
    expect(res.status).toBe(200);
    expect(tabRows('fin_expense')[0].approval_status).toBe('APPROVED');
  });
});