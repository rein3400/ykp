/**
 * Expense approve route self-approve guard — mocked Sheets layer.
 *
 * Drives the REAL expense approve POST handler against an in-memory fake of
 * @/db/sheets and asserts:
 *   1. The session user who created the expense cannot approve it → 400 with
 *      a segregation-of-duties error.
 *   2. A DIFFERENT finance_admin approver still succeeds → 200.
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
    expense: 'fin_expense',
    pettyCash: 'fin_petty_cash',
    auditLog: 'system_audit_log'
  } as const;
  return {
    TABS,
    findRow: async (tab: string, col: string, val: string) => {
      const rows = tabRows(tab);
      const idx = rows.findIndex((r) => r[col] === val);
      return idx >= 0 ? { row: rows[idx], rowNumber: idx + 2 } : null;
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

let sessionUser = { userId: 'USR-001', role: 'finance_admin' };
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

// ── Import under test (after mocks) ───────────────────────────────
import { POST } from '@/app/api/finance/expenses/[id]/approve/route';

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
    brand_id: 'BR-1',
    brand_name: 'Brand',
    outlet_id: 'OL-1',
    outlet_name: 'Outlet',
    expense_category: 'OPS',
    description: 'test expense',
    amount: '300000',
    payment_method: 'CASH',
    receipt_url: '',
    approval_status: 'PENDING',
    approved_by: '',
    created_by: 'USR-001',
    created_at: '2026-08-21 10:00:00',
    updated_at: '',
    ...over
  });
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  sessionUser = { userId: 'USR-001', role: 'finance_admin' };
});

describe('expense approve self-approve guard', () => {
  it('rejects the creator approving their own expense (segregation of duties)', async () => {
    seedExpense({ created_by: 'USR-001' });
    sessionUser = { userId: 'USR-001', role: 'finance_admin' };
    const res = await POST(req({ action: 'approve' }), ctx('EXP-1'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(JSON.stringify(json)).toContain('segregation of duties');
    // row must NOT be mutated to APPROVED
    expect(tabRows('fin_expense')[0].approval_status).toBe('PENDING');
  });

  it('allows a DIFFERENT finance_admin to approve the same expense', async () => {
    seedExpense({ created_by: 'USR-001' });
    sessionUser = { userId: 'USR-002', role: 'finance_admin' };
    const res = await POST(req({ action: 'approve' }), ctx('EXP-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.approval_status).toBe('APPROVED');
    expect(json.data.approved_by).toBe('USR-002');
  });

  it('self-approve still blocked even for owner role', async () => {
    seedExpense({ created_by: 'USR-001' });
    sessionUser = { userId: 'USR-001', role: 'owner' };
    const res = await POST(req({ action: 'approve' }), ctx('EXP-1'));
    expect(res.status).toBe(400);
    expect(tabRows('fin_expense')[0].approval_status).toBe('PENDING');
  });

  it('creator can REJECT their own expense (not a self-approval)', async () => {
    seedExpense({ created_by: 'USR-001' });
    sessionUser = { userId: 'USR-001', role: 'finance_admin' };
    const res = await POST(req({ action: 'reject' }), ctx('EXP-1'));
    expect(res.status).toBe(200);
    expect(tabRows('fin_expense')[0].approval_status).toBe('REJECTED');
  });
});