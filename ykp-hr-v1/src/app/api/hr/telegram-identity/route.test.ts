/**
 * Tests for POST /api/hr/telegram-identity — cross-division resolution.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { POST } from './route';

process.env.TELEGRAM_BOT_SECRET = process.env.TELEGRAM_BOT_SECRET ?? 'test-bot-secret-000';

function req(body: unknown, secret = process.env.TELEGRAM_BOT_SECRET) {
  return new Request('http://127.0.0.1/api/hr/telegram-identity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bot-secret': secret ?? '' },
    body: JSON.stringify(body)
  });
}

const CTX = { params: Promise.resolve({} as Record<string, string>) };

beforeAll(async () => {
  // seed a linked user through the public repo helpers (mock store in tests)
  const { appendRows, TABS } = await import('@/db/sheets');
  await appendRows(TABS.users, [
    {
      user_id: 'USR-TG-1',
      username: 'linked.owner',
      password_hash: '',
      role: 'owner',
      brand_id: 'BR-001',
      outlet_id: '',
      department: '',
      employee_id: '',
      telegram_id: '424242',
      active_status: 'active',
      must_change_password: '',
      created_at: '2026-08-23 00:00:00',
      last_login_at: ''
    }
  ]);
});

describe('POST /api/hr/telegram-identity', () => {
  it('rejects without bot secret', async () => {
    const res = await POST(req({ telegram_chat_id: '424242' }, 'wrong-secret'), CTX);
    expect(res.status).toBe(401);
  });

  it('rejects missing chat id', async () => {
    const res = await POST(req({}), CTX);
    expect(res.status).toBe(400);
  });

  it('returns linked:false for unknown chat id', async () => {
    const res = await POST(req({ telegram_chat_id: '999999' }), CTX);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.linked).toBe(false);
  });

  it('resolves a linked chat id with primary role', async () => {
    const res = await POST(req({ telegram_chat_id: '424242' }), CTX);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.linked).toBe(true);
    expect(json.data.primary.role).toBe('owner');
    expect(json.data.primary.division).toBe('hr');
    expect(json.data.identities).toHaveLength(1);
  });
});
