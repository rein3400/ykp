import { afterEach, describe, expect, it, vi } from 'vitest';
import { telegramBotToken } from './bot-token';
afterEach(() => vi.unstubAllEnvs());
describe('ops bot identity', () => {
  it('prefers the dedicated ops bot token so replies are not sent by the HR bot', () => {
    vi.stubEnv('TELEGRAM_OPS_BOT_TOKEN', 'ops-token');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'hr-token');
    expect(telegramBotToken()).toBe('ops-token');
  });
  it('falls back to the shared token when no ops token is configured', () => {
    vi.stubEnv('TELEGRAM_OPS_BOT_TOKEN', '');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'shared-token');
    expect(telegramBotToken()).toBe('shared-token');
  });
  it('returns an empty string when nothing is configured', () => {
    vi.stubEnv('TELEGRAM_OPS_BOT_TOKEN', '');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    expect(telegramBotToken()).toBe('');
  });
});
