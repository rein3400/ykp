import { describe, it, expect, vi } from 'vitest';
import { isInSession } from '../src/modules/session-filter.js';

vi.mock('../src/config/env.js', () => ({ env: { SESSION_STRICT: true } }));

describe('isInSession', () => {
  it('matches New York Silver Bullet window', () => {
    const now = new Date('2026-07-06T03:30:00.000Z'); // WIB 10:30
    const r = isInSession(now);
    expect(r.inSession).toBe(true);
    expect(r.window).toBe('NY_SB');
  });

  it('rejects out-of-window time', () => {
    const now = new Date('2026-07-06T08:00:00.000Z'); // WIB 15:00
    const r = isInSession(now);
    expect(r.inSession).toBe(false);
    expect(r.reason).toContain('out of silver bullet');
  });

  it('allows payloadSession narrowing', () => {
    const now = new Date('2026-07-06T03:30:00.000Z'); // WIB 10:30
    const r = isInSession(now, 'NY_SB');
    expect(r.inSession).toBe(true);
  });
});