import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
const set = vi.hoisted(() => vi.fn());
vi.mock('@/lib/session', () => ({ setSession: set }));
describe('Ops login bridge', () => {
  it('cannot create a session from an unauthenticated role query', async () => {
    const response = await GET(new NextRequest('https://ops.example/api/auth/login?role=OWNER&redirect=/ops'), { params: Promise.resolve({}) });
    expect(response.status).toBe(401);
    expect(set).not.toHaveBeenCalled();
  });
});
