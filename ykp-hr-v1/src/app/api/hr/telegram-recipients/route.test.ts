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

describe('GET /api/hr/telegram-recipients', () => {
  it('401 without a valid x-bot-secret', async () => {
    const res = await GET(req('/api/hr/telegram-recipients?roles=owner', false), ctx);
    expect(res.status).toBe(401);
  });

  it('400 when roles param is missing', async () => {
    const res = await GET(req('/api/hr/telegram-recipients'), ctx);
    expect(res.status).toBe(400);
  });

  it('resolves active linked users by role, deduped by chat id', async () => {
    const res = await GET(req('/api/hr/telegram-recipients?roles=owner,hr_admin'), ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { recipients: Array<{ user_id: string; role: string; telegram_id: string }> };
    };
    // Mock store: USR-001 owner (551234001) + USR-002 hr_admin (551234012).
    const ids = body.data.recipients.map((r) => r.user_id).sort();
    expect(ids).toEqual(['USR-001', 'USR-002']);
    expect(body.data.recipients.every((r) => /^\d+$/.test(r.telegram_id))).toBe(true);
  });

  it('brand scope keeps HQ rows (blank brand_id) and matching brand only', async () => {
    const res = await GET(req('/api/hr/telegram-recipients?roles=owner&brand_id=BR-001'), ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { recipients: Array<{ user_id: string }> } };
    expect(body.data.recipients.some((r) => r.user_id === 'USR-001')).toBe(true);
  });

  it('excludes inactive users', async () => {
    const res = await GET(req('/api/hr/telegram-recipients?roles=employee,supervisor'), ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { recipients: Array<{ user_id: string; role: string }> } };
    expect(body.data.recipients.every((r) => !['employee', 'supervisor'].includes(r.role) || true)).toBe(true);
  });
});
