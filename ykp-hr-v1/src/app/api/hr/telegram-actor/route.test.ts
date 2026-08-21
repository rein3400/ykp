import { describe, it, expect, beforeAll } from 'vitest';
import { GET } from './route';

// Force mock DB so the route resolves against the seeded in-memory store.
beforeAll(() => {
  process.env.USE_MOCK_DB = 'true';
  process.env.TELEGRAM_BOT_SECRET = 'test-secret-1234567890';
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.YKP_HR_SPREADSHEET_ID;
});

function req(url: string, withSecret = true): Request {
  return new Request(`http://localhost${url}`, {
    headers: withSecret ? { 'x-bot-secret': 'test-secret-1234567890' } : {}
  });
}

const ctx = { params: Promise.resolve({}) };

describe('GET /api/hr/telegram-actor', () => {
  it('resolves a linked owner chat id to an RBAC actor', async () => {
    // EMP-001 (Budi) has telegram_id 551234001 and user USR-001 role owner.
    const res = await GET(req('/api/hr/telegram-actor?telegram_id=551234001'), ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, string> };
    expect(body.data.role).toBe('owner');
    expect(body.data.employee_id).toBe('EMP-001');
    expect(body.data.user_id).toBe('USR-001');
  });

  it('resolves a linked hr_admin chat id', async () => {
    // EMP-012 (Rina) has telegram_id 551234012 and user USR-002 role hr_admin.
    const res = await GET(req('/api/hr/telegram-actor?telegram_id=551234012'), ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, string> };
    expect(body.data.role).toBe('hr_admin');
  });

  it('returns 404 for an unlinked chat id', async () => {
    const res = await GET(req('/api/hr/telegram-actor?telegram_id=999999999'), ctx);
    expect(res.status).toBe(404);
  });

  it('returns 400 when telegram_id is missing', async () => {
    const res = await GET(req('/api/hr/telegram-actor'), ctx);
    expect(res.status).toBe(400);
  });

  it('returns 401 without a valid x-bot-secret', async () => {
    const res = await GET(req('/api/hr/telegram-actor?telegram_id=551234001', false), ctx);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a wrong x-bot-secret of the same length (bug #6, constant-time)', async () => {
    // Same length as the configured secret but differing bytes — must still
    // be rejected. Guards the safeEqual replacement of the !== compare.
    const res = await GET(
      new Request('http://localhost/api/hr/telegram-actor?telegram_id=551234001', {
        headers: { 'x-bot-secret': 'test-secret-1234567891' }
      }),
      ctx
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 for a wrong x-bot-secret of a different length (bug #6)', async () => {
    const res = await GET(
      new Request('http://localhost/api/hr/telegram-actor?telegram_id=551234001', {
        headers: { 'x-bot-secret': 'short' }
      }),
      ctx
    );
    expect(res.status).toBe(401);
  });
});
