import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSmtpConfig } from './app-settings';
vi.mock('@/db/sheets', () => ({ TABS: { appSettings: 'app_settings' }, readTab: async () => [
  { setting_key: 'smtp_user', setting_value: 'ykp.erp@gmail.com' },
  { setting_key: 'smtp_pass', setting_value: '' }
] }));
afterEach(() => vi.unstubAllEnvs());
describe('sender credential reset', () => {
  it('does not reuse environment password after an explicit database credential reset', async () => {
    vi.stubEnv('SMTP_PASS', 'old-account-test-only');
    vi.stubEnv('SMTP_USER', 'old@example.invalid');
    const config = await getSmtpConfig();
    expect(config.user).toBe('ykp.erp@gmail.com');
    expect(config.pass).toBe('');
  });
});
