import { describe, it, expect, vi, afterEach } from 'vitest';
import { rateLimit, clientKey } from '@/lib/ratelimit';

afterEach(() => {
  vi.useRealTimers();
});

describe('rateLimit decision logic', () => {
  it('allows up to the limit within the window', () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 10; i++) {
      const r = rateLimit(key, 10, 60_000);
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(10 - i - 1);
    }
  });
  it('blocks the request after the limit', () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 10; i++) rateLimit(key, 10, 60_000);
    const r = rateLimit(key, 10, 60_000);
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });
  it('tracks keys independently', () => {
    const a = `test:${Math.random()}`;
    const b = `test:${Math.random()}`;
    for (let i = 0; i < 10; i++) rateLimit(a, 10, 60_000);
    expect(rateLimit(a, 10, 60_000).ok).toBe(false);
    expect(rateLimit(b, 10, 60_000).ok).toBe(true);
  });
  it('resets after the window expires', () => {
    vi.useFakeTimers();
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 10; i++) rateLimit(key, 10, 60_000);
    expect(rateLimit(key, 10, 60_000).ok).toBe(false);
    vi.setSystemTime(Date.now() + 61_000);
    expect(rateLimit(key, 10, 60_000).ok).toBe(true);
  });
});

describe('clientKey', () => {
  it('prefers userId when present', () => {
    const req = new Request('http://x', { headers: { 'x-forwarded-for': '1.2.3.4' } });
    expect(clientKey(req, 'USR-1')).toBe('u:USR-1');
  });
  it('uses first x-forwarded-for IP', () => {
    const req = new Request('http://x', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } });
    expect(clientKey(req)).toBe('ip:1.2.3.4');
  });
  it('falls back to unknown', () => {
    expect(clientKey(new Request('http://x'))).toBe('ip:unknown');
  });
});
