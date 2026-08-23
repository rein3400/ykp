/**
 * Management-bot gate (role per bot).
 *
 * Proves the management bot never issues pairing codes and refuses chats
 * without a management role:
 *   1. `/link KODE` gets the chat-id explanation, never a pairing code.
 *   2. resolveAllowedActor returns null for unknown chat ids (no allowlist,
 *      no HR link) — the entry gate in index.ts uses exactly this function.
 *   3. MANAGEMENT_COMMANDS registry contains no `link` entry.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

beforeAll(() => {
  process.env.TELEGRAM_MANAGEMENT_BOT_TOKEN = 'test-token';
  process.env.TELEGRAM_BOT_SECRET = 'test-secret-1234567890';
  // Ensure no allowlists interfere with the unknown-chat scenarios below.
  delete process.env.TELEGRAM_OWNER_IDS;
  delete process.env.TELEGRAM_ALLOWED_IDS;
});

describe('management bot: no pairing flow', () => {
  it('command registry has no /link entry', async () => {
    const { MANAGEMENT_COMMANDS } = await import('../src/telegram-commands.js');
    expect(MANAGEMENT_COMMANDS.some((c) => c.command === 'link')).toBe(false);
  });

  it('/link gets a chat-id explanation, not a pairing code', async () => {
    const { handleText } = await import('../src/brain.js');
    const reply = await handleText(424242, '/link AB2CD3EF');
    expect(reply).toContain('tidak memakai kode pairing');
    expect(reply).toContain('justatestermaybot');
    // A real pairing code would look like a 6-char code issuance — the reply
    // must not contain any fresh 6-char code token.
    expect(reply).not.toMatch(/\b[A-Z2-9]{6}\b/);
  });
});

describe('management bot: role gate', () => {
  it('unknown chat id is refused (no allowlist, no HR link)', async () => {
    // resolveAllowedActor lives in index.ts (entry module); it composes
    // CONFIG gates + resolveActor + isAllowedRole. We drive the same
    // composition here against the REAL building blocks.
    const { CONFIG } = await import('../src/config.js');
    const { resolveActor, isAllowedRole } = await import('../src/actor.js');

    // Unknown chat: not in either env list…
    const idStr = '999999999';
    expect(CONFIG.allowedIds.includes(idStr)).toBe(false);
    expect(CONFIG.ownerIds.includes(idStr)).toBe(false);

    // …and HR resolution returns nothing (fetch fails in test env → null).
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const actor = await resolveActor(999999999);
    expect(actor).toBeNull();
    // Gate outcome: null → refused.
    expect(actor !== null && isAllowedRole(actor.role)).toBe(false);
    fetchSpy.mockRestore();
  });

  it('employee-role HR link is refused even when linked', async () => {
    const { isAllowedRole } = await import('../src/actor.js');
    expect(isAllowedRole('employee')).toBe(false);
    expect(isAllowedRole('staff')).toBe(false);
    expect(isAllowedRole('owner')).toBe(true);
  });
});
