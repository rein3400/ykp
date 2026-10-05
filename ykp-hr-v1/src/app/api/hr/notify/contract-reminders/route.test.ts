import { describe, it, expect, vi } from 'vitest';
import { GET, POST } from './route';

vi.mock('@/lib/audit', () => ({ logAudit: () => Promise.resolve() }));
vi.mock('@/lib/telegram', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/telegram')>();
  return { ...mod, sendTelegram: vi.fn(() => Promise.resolve({ deliveryId: 'D-1', status: 'SENT', sent: 1, failed: 0 })) };
});

function req(headers?: Record<string, string>): Request {
  return new Request('http://localhost/api/hr/notify/contract-reminders', {
    method: 'GET',
    headers: { 'content-type': 'application/json', ...(headers ?? {}) }
  });
}

const ctx = { params: Promise.resolve({}) };

describe('GET /api/hr/notify/contract-reminders access control', () => {
  it('rejects anonymous requests with 401 and no employee data', async () => {
    process.env.CRON_SECRET = 'e2e-cron-secret-32chars-minimum-ok!!';
    process.env.USE_MOCK_DB = 'true';
    const res = await GET(req(), ctx);
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).not.toContain('candidates');
    expect(body).not.toContain('employee');
    delete process.env.CRON_SECRET;
  });

  it('accepts the owner/test-fire caller with a valid x-cron-secret', async () => {
    process.env.CRON_SECRET = 'e2e-cron-secret-32chars-minimum-ok!!';
    process.env.USE_MOCK_DB = 'true';
    const res = await GET(req({ 'x-cron-secret': 'e2e-cron-secret-32chars-minimum-ok!!' }), ctx);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Array.isArray(j.data.candidates)).toBe(true);
    delete process.env.CRON_SECRET;
  });
});