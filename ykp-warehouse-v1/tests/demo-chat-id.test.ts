/**
 * Demo chat-id wiring proof — drives the real resolveRecipients() function
 * (the exact function warehouse alert push / role-routed notify calls)
 * against a mocked users tab seeded with the presenter chat id on the
 * active owner row.
 *
 * Asserts resolveRecipients('role:owner') returns ['5694784154'] so the
 * notify path resolves a non-empty chat id equal to the demo chat id.
 * Also covers user: selector + empty/bad inputs to lock the contract.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const DEMO_CHAT_ID = '5694784154';

const usersRows: Record<string, string>[] = [];

vi.mock('@/db/sheets', async () => {
  const TABS = {
    users: 'users',
    telegramDeliveryLog: 'telegram_delivery_log',
    telegramLinkCodes: 'telegram_link_codes',
    alertLog: 'alert_log'
  } as const;
  return {
    TABS,
    readTab: async (tab: string) => {
      if (tab === 'users') return usersRows.map((r) => ({ ...r }));
      return [];
    },
    findRow: async (tab: string, col: string, val: string) => {
      const i = usersRows.findIndex((r) => r[col] === val);
      return i >= 0 ? { row: { ...usersRows[i] }, rowNumber: i + 2 } : null;
    },
    appendRows: async () => 2,
    updateRow: async () => undefined
  };
});

import { resolveRecipients } from '@/lib/telegram';

describe('resolveRecipients (demo chat id wiring)', () => {
  beforeEach(() => {
    usersRows.length = 0;
    usersRows.push({
      user_id: 'U-001',
      username: 'owner',
      password_hash: 'x',
      role: 'owner',
      brand_id: '',
      outlet_id: '',
      department: '',
      employee_id: 'EMP-001',
      telegram_id: DEMO_CHAT_ID,
      active_status: 'active',
      must_change_password: 'false',
      created_at: '',
      last_login_at: ''
    });
  });

  it('role:owner resolves to the demo chat id', async () => {
    const ids = await resolveRecipients('role:owner');
    expect(ids).toEqual([DEMO_CHAT_ID]);
  });

  it('user:U-001 resolves to the demo chat id', async () => {
    const ids = await resolveRecipients('user:U-001');
    expect(ids).toEqual([DEMO_CHAT_ID]);
  });

  it('role:owner skips inactive users', async () => {
    usersRows[0].active_status = 'inactive';
    const ids = await resolveRecipients('role:owner');
    expect(ids).toEqual([]);
  });

  it('role:owner returns [] when telegram_id empty', async () => {
    usersRows[0].telegram_id = '';
    const ids = await resolveRecipients('role:owner');
    expect(ids).toEqual([]);
  });

  it('role:viewer returns [] (no viewer row seeded with a chat id)', async () => {
    const ids = await resolveRecipients('role:viewer');
    expect(ids).toEqual([]);
  });

  it('empty selector returns []', async () => {
    const ids = await resolveRecipients('');
    expect(ids).toEqual([]);
  });

  it('raw chat id passes through', async () => {
    const ids = await resolveRecipients(DEMO_CHAT_ID);
    expect(ids).toEqual([DEMO_CHAT_ID]);
  });
});