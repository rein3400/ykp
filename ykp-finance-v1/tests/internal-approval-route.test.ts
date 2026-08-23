/**
 * Internal Telegram-approval endpoint (Fase 4) — mocked Sheets layer.
 *
 * Drives the REAL POST handler and asserts:
 *   1. 401 without/with wrong x-bot-secret.
 *   2. 400 for bad action / non-numeric chat id / unknown record prefix.
 *   3. Presser resolved from users.telegram_id → decision applied via the
 *      approval FSM (PENDING → APPROVED), approved_by = presser user_id.
 *   4. Segregation of duties: creator pressing Approve → 400, row untouched.
 *   5. Idempotency/conflict: second decision on a decided row → 409-free
 *      clear error (transition guard).
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { NextRequest } from 'next/server';

const SECRET = 'test-secret-1234567890';

// The route reads the shared secret lazily from process.env; set it before
// any route module is imported (same pattern as hermez gateway tests).
beforeAll(() => {
  process.env.TELEGRAM_BOT_SECRET = SECRET;
});

interface FakeTab { rows: Record<string, string>[] }
const db: Record<string, FakeTab> = {};

function tabRows(tab: string): Record<string, string>[] {
  return (db[tab] ??= { rows: [] }).rows;
}

vi.mock('@/db/sheets', async () => ({
  TABS: { users: 'users', expense: 'fin_expense' },
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
  }
}));

vi.mock('@/lib/audit', () => ({ logAudit: async () => undefined }));

import { POST } from '@/app/api/internal/approval/route';

function req(body: unknown, secret?: string): NextRequest {
  return new NextRequest('http://localhost/api/internal/approval', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...(secret !== undefined ? { 'x-bot-secret': secret } : {}) }
  });
}

function seed(): void {
  for (const k of Object.keys(db)) delete db[k];
  tabRows('users').push(
    { user_id: 'USR-001', username: 'kasir', role: 'finance_admin', telegram_id: '551111111', active_status: 'active' },
    { user_id: 'USR-002', username: 'owner', role: 'owner', telegram_id: '5721500978', active_status: 'active' }
  );
  tabRows('fin_expense').push({
    expense_id: 'EXP-TG1',
    amount: '750000',
    approval_status: 'PENDING',
    approved_by: '',
    created_by: 'USR-001',
    updated_at: ''
  });
}

beforeEach(seed);

describe('internal approval endpoint', () => {
  it('401 without and with wrong secret', async () => {
    expect((await POST(req({ record_id: 'EXP-TG1', action: 'approve', telegram_chat_id: '5721500978' }), { params: Promise.resolve({}) })).status).toBe(401);
    expect((await POST(req({ record_id: 'EXP-TG1', action: 'approve', telegram_chat_id: '5721500978' }, 'nope'), { params: Promise.resolve({}) })).status).toBe(401);
  });

  it('400 on invalid action / chat id / unknown prefix', async () => {
    const h = SECRET;
    expect((await POST(req({ record_id: 'EXP-TG1', action: 'maybe', telegram_chat_id: '5721500978' }, h), { params: Promise.resolve({}) })).status).toBe(400);
    expect((await POST(req({ record_id: 'EXP-TG1', action: 'approve', telegram_chat_id: 'abc' }, h), { params: Promise.resolve({}) })).status).toBe(400);
    expect((await POST(req({ record_id: 'ZZZ-9', action: 'approve', telegram_chat_id: '5721500978' }, h), { params: Promise.resolve({}) })).status).toBe(400);
  });

  it('approves via owner chat id — FSM applies, audit trail has presser id', async () => {
    const res = await POST(req({ record_id: 'EXP-TG1', action: 'approve', telegram_chat_id: '5721500978' }, SECRET), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.approval_status).toBe('APPROVED');
    expect(tabRows('fin_expense')[0].approved_by).toBe('USR-002');
  });

  it('rejects the creator approving own expense (segregation of duties)', async () => {
    const res = await POST(req({ record_id: 'EXP-TG1', action: 'approve', telegram_chat_id: '551111111' }, SECRET), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('segregation of duties');
    expect(tabRows('fin_expense')[0].approval_status).toBe('PENDING');
  });

  it('second approve after APPROVED is refused by transition guard', async () => {
    await POST(req({ record_id: 'EXP-TG1', action: 'approve', telegram_chat_id: '5721500978' }, SECRET), { params: Promise.resolve({}) });
    const res2 = await POST(req({ record_id: 'EXP-TG1', action: 'reject', telegram_chat_id: '5721500978' }, SECRET), { params: Promise.resolve({}) });
    expect(res2.status).toBe(400);
    expect(tabRows('fin_expense')[0].approval_status).toBe('APPROVED');
  });

  it('unknown chat id → 400 with clear message', async () => {
    const res = await POST(req({ record_id: 'EXP-TG1', action: 'approve', telegram_chat_id: '999999' }, SECRET), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('No user linked');
  });
});
