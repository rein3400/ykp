import { env } from '../config/env.js';

export type BreakerState = 'closed' | 'open' | 'half-open';

export interface BreakerOptions {
  threshold?: number;        // failures within window to trip
  windowMs?: number;         // failure count window
  cooldownMs?: number;       // open -> half-open
  name: string;
}

interface BreakerRecord {
  state: BreakerState;
  failures: number[];        // timestamps
  lastOpened?: number;
}

const store: Map<string, BreakerRecord> = new Map();

export function getBreaker(name: string): BreakerRecord {
  if (!store.has(name)) {
    store.set(name, { state: 'closed', failures: [] });
  }
  return store.get(name)!;
}

export function breakerState(name: string): BreakerState {
  const b = getBreaker(name);
  if (b.state === 'open' && b.lastOpened && Date.now() - b.lastOpened > (env.MT5_BREAKER_THRESHOLD * 2000)) {
    b.state = 'half-open';
  }
  return b.state;
}

export function recordSuccess(name: string): void {
  const b = getBreaker(name);
  b.failures = [];
  b.state = 'closed';
  b.lastOpened = undefined;
}

export function recordFailure(name: string): void {
  const b = getBreaker(name);
  const now = Date.now();
  b.failures = b.failures.filter((t) => now - t < 60000);
  b.failures.push(now);
  if (b.failures.length >= env.MT5_BREAKER_THRESHOLD && b.state !== 'open') {
    b.state = 'open';
    b.lastOpened = now;
  }
}

export async function withBreaker<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const st = breakerState(name);
  if (st === 'open') {
    throw new Error(`circuit breaker ${name} is OPEN`);
  }
  try {
    const r = await fn();
    recordSuccess(name);
    return r;
  } catch (err) {
    recordFailure(name);
    throw err;
  }
}
