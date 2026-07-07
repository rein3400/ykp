import { describe, it, expect, vi } from 'vitest';
import { withBreaker, recordFailure, recordSuccess, getBreaker } from '../src/services/circuit-breaker.js';

vi.mock('../src/config/env.js', () => ({ env: { MT5_BREAKER_THRESHOLD: 3 } }));

describe('circuit-breaker', () => {
  it('trips open after threshold failures in window', async () => {
    const name = `test-${Date.now()}-a`;
    getBreaker(name); // init
    recordFailure(name);
    recordFailure(name);
    recordFailure(name);
    await expect(withBreaker(name, async () => 'x')).rejects.toThrow(/OPEN/);
  });

  it('recovers on success', async () => {
    const name = `test-${Date.now()}-b`;
    recordSuccess(name);
    const r = await withBreaker(name, async () => 'ok');
    expect(r).toBe('ok');
  });
});