import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

describe('Warehouse health access', () => {
  it('allows GET count but protects summaries, mutations, and nested paths', async () => {
    expect((await middleware(new NextRequest('http://localhost/api/warehouse/summary/count'))).status).toBe(200);
    expect((await middleware(new NextRequest('http://localhost/api/warehouse/summary'))).status).toBe(401);
    expect((await middleware(new NextRequest('http://localhost/api/warehouse/summary/count', { method: 'POST' }))).status).toBe(401);
    expect((await middleware(new NextRequest('http://localhost/api/warehouse/summary/count/private'))).status).toBe(401);
  });
});
