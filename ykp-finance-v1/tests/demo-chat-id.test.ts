/**
 * Demo chat-id wiring proof — drives the real getOwnerChatId() resolver
 * (the exact function finance daily-brief/alert push calls) against a
 * mocked app_settings tab seeded with the presenter chat id.
 *
 * This asserts the recipient path resolves to the demo chat id, not a
 * hardcoded assumption — if the settings row were missing/empty, the
 * resolver would fall through to TELEGRAM_CHAT_ID env (tested too).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const DEMO_CHAT_ID = '5694784154';

const settingsRows: Record<string, string>[] = [];

vi.mock('@/db/sheets', async () => {
  const TABS = {
    appSettings: 'app_settings',
    users: 'users',
    telegramDeliveryLog: 'telegram_delivery_log',
    telegramLinkCodes: 'telegram_link_codes'
  } as const;
  return {
    TABS,
    readTab: async (tab: string) => {
      if (tab === 'app_settings') return settingsRows.map((r) => ({ ...r }));
      return [];
    },
    findRow: async (tab: string, col: string, val: string) => {
      const i = settingsRows.findIndex((r) => r[col] === val);
      return i >= 0 ? { row: { ...settingsRows[i] }, rowNumber: i + 2 } : null;
    },
    appendRows: async () => 2,
    updateRow: async () => undefined
  };
});

import { getOwnerChatId, getSetting, SETTING_OWNER_CHAT_ID } from '@/lib/settings';

describe('getOwnerChatId (demo chat id wiring)', () => {
  beforeEach(() => {
    settingsRows.length = 0;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('resolves to the demo chat id from the app_settings row', async () => {
    settingsRows.push({
      setting_key: SETTING_OWNER_CHAT_ID,
      setting_value: DEMO_CHAT_ID,
      description: 'Chat id Telegram owner untuk daily brief & alert push',
      updated_by: 'U-001',
      updated_at: '2026-08-21 00:00:00'
    });
    const chatId = await getOwnerChatId();
    expect(chatId).toBe(DEMO_CHAT_ID);
  });

  it('falls back to TELEGRAM_CHAT_ID env when settings row is empty', async () => {
    process.env.TELEGRAM_CHAT_ID = DEMO_CHAT_ID;
    const chatId = await getOwnerChatId();
    expect(chatId).toBe(DEMO_CHAT_ID);
  });

  it('returns empty when neither settings nor env is set', async () => {
    const chatId = await getOwnerChatId();
    expect(chatId).toBe('');
  });

  it('settings row takes priority over env', async () => {
    settingsRows.push({
      setting_key: SETTING_OWNER_CHAT_ID,
      setting_value: DEMO_CHAT_ID,
      description: '',
      updated_by: 'U-001',
      updated_at: ''
    });
    process.env.TELEGRAM_CHAT_ID = '9999999999';
    const chatId = await getOwnerChatId();
    expect(chatId).toBe(DEMO_CHAT_ID);
  });

  it('getSetting reads the exact key used by the notify path', async () => {
    settingsRows.push({
      setting_key: SETTING_OWNER_CHAT_ID,
      setting_value: DEMO_CHAT_ID,
      description: '',
      updated_by: '',
      updated_at: ''
    });
    const val = await getSetting(SETTING_OWNER_CHAT_ID);
    expect(val).toBe(DEMO_CHAT_ID);
  });
});