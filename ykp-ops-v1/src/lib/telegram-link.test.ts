import { describe, expect, it, vi } from 'vitest';
import { consumeLinkCode, createLinkCode } from './telegram';
import { TAB_HEADERS, TABS } from '@/db/sheets';
const state = vi.hoisted(() => ({ fail: false }));
vi.mock('@/db/sheets', async (original) => ({
  ...await original<typeof import('@/db/sheets')>(),
  findRow: async () => ({ rowIndex: 2, row: { user_id: 'U1', active_status: 'active' } }),
  updateRow: async () => { if (state.fail) throw new Error('Unavailable'); }
}));
describe('Ops linking persistence', () => {
  it('declares telegram_id without moving existing user columns', () => {
    expect(TAB_HEADERS[TABS.users].slice(0, 3)).toEqual(['user_id', 'username', 'password_hash']);
    expect(TAB_HEADERS[TABS.users]).toContain('telegram_id');
  });
  it('does not return success or consume the code when persistence fails', async () => {
    const code = createLinkCode('U1');
    state.fail = true;
    await expect(consumeLinkCode(code, '123456789')).rejects.toThrow('Unavailable');
    state.fail = false;
    expect(await consumeLinkCode(code, '123456789')).toBe('U1');
    expect(await consumeLinkCode(code, '123456789')).toBeNull();
  });
});
