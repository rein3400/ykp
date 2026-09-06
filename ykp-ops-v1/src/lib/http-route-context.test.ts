import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest, NextResponse } from 'next/server';
import { handler, ok, badRequest } from './http';

/**
 * Regression coverage for the Next 16 route-handler context fix.
 * The wrapper's second argument must be the required RouteContext
 * (`{ params: Promise<...> }`); these tests pin the runtime behavior:
 * dynamic Promise params are awaited, inner error responses pass through
 * unchanged, throws map to internal_error without leaking, and the
 * static-route / legacy-caller edges (missing ctx, sync params) resolve
 * to `{}` / the given object instead of 500ing.
 */
function req(url = 'http://localhost/api/ops/incidents/INC-007'): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe('handler route-context compat (Next16)', () => {
  it('awaits dynamic Promise params and returns the inner response', async () => {
    const wrapped = handler(async (_req, ctx) => ok({ id: ctx.params.id }));
    const res = await wrapped(req(), { params: Promise.resolve({ id: 'INC-007' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: 'INC-007' } });
  });

  it('passes inner error responses through unchanged', async () => {
    const wrapped = handler(async () => badRequest('username and password required'));
    const res = await wrapped(req('http://localhost/api/auth/login'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: 'bad_request', message: 'username and password required' },
    });
  });

  it('maps an inner throw to internal_error without leaking the message', async () => {
    const wrapped = handler(async () => {
      throw new Error('boom-secret-stack');
    });
    const res = await wrapped(req(), { params: Promise.resolve({}) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('internal_error');
    expect(body.error.message).toContain('Internal server error');
    expect(body.error.message).not.toContain('boom-secret-stack');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('tolerates a missing context at runtime (static-route / direct-call edge)', async () => {
    const wrapped = handler(async (_req, ctx) => ok({ id: ctx.params.id ?? 'none' }));
    const singleArg = wrapped as unknown as (r: NextRequest) => Promise<NextResponse>;
    const res = await singleArg(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: 'none' } });
  });

  it('tolerates legacy sync params objects', async () => {
    const wrapped = handler(async (_req, ctx) => ok({ id: ctx.params.id }));
    const legacy = { params: { id: 'SYNC-1' } } as unknown as {
      params: Promise<Record<string, string>>;
    };
    const res = await wrapped(req(), legacy);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: 'SYNC-1' } });
  });
});
