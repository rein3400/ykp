/**
 * Demo chat-id wiring proof — drives the real sendTelegram() function
 * (the exact function investor daily-brief/alert push calls) with an
 * empty recipient so it falls back to TELEGRAM_CHAT_ID env, set to the
 * presenter chat id. Fetch is mocked so no network call leaves the test.
 *
 * Asserts the delivery log row's recipient equals the demo chat id and
 * status is SENT — proving the notify path resolves to the demo chat id.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const DEMO_CHAT_ID = '5694784154';

const deliveryLog: Record<string, string>[] = [];

vi.mock('@/db/sheets', async () => {
  const TABS = {
    telegramDeliveryLog: 'telegram_delivery_log',
    telegramLinkCodes: 'telegram_link_codes'
  } as const;
  return {
    TABS,
    readTab: async () => [],
    findRow: async () => null,
    appendRows: async (_tab: string, rows: Record<string, string>[]) => {
      deliveryLog.push(...rows.map((r) => ({ ...r })));
      return 2;
    },
    updateRow: async () => undefined
  };
});

const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ ok: true, result: { message_id: 42 } })
}));

global.fetch = fetchMock as unknown as typeof fetch;

import { sendTelegram } from '@/lib/telegram';

describe('sendTelegram demo chat id wiring', () => {
  beforeEach(() => {
    deliveryLog.length = 0;
    fetchMock.mockClear();
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_CHAT_ID = DEMO_CHAT_ID;
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('empty recipient falls back to TELEGRAM_CHAT_ID env = demo chat id', async () => {
    const result = await sendTelegram({
      sourceModule: 'investor',
      sourceReferenceId: 'daily-2026-08-21',
      messageType: 'DAILY_BRIEF',
      recipient: '',
      text: 'YKP INVESTOR DAILY BRIEF'
    });
    expect(result.status).toBe('SENT');
    expect(deliveryLog).toHaveLength(1);
    expect(deliveryLog[0].recipient).toBe(DEMO_CHAT_ID);
    expect(deliveryLog[0].status).toBe('SENT');
    expect(deliveryLog[0].message_id).toBe('42');
  });

  it('explicit recipient overrides env', async () => {
    await sendTelegram({
      sourceModule: 'investor',
      sourceReferenceId: 'ALR-1',
      messageType: 'ALERT',
      recipient: '1111111111',
      text: 'alert'
    });
    expect(deliveryLog[0].recipient).toBe('1111111111');
  });

  it('FAILED when env not set and recipient empty', async () => {
    delete process.env.TELEGRAM_CHAT_ID;
    const result = await sendTelegram({
      sourceModule: 'investor',
      sourceReferenceId: 'x',
      messageType: 'ALERT',
      recipient: '',
      text: 'x'
    });
    expect(result.status).toBe('FAILED');
    expect(deliveryLog[0].status).toBe('FAILED');
  });
});