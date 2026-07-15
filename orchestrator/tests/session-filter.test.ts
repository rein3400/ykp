import { describe, it, expect, vi } from 'vitest';
import { isInSession } from '../src/modules/session-filter.js';

vi.mock('../src/config/env.js', () => ({ env: { SESSION_STRICT: true } }));

describe('isInSession (Kill Zone WIB)', () => {
  it('matches New York Kill Zone / Silver Bullet', () => {
    // 08:30 UTC = 15:30 WIB → NY_SB (15:00-16:00) and NY_KZ (14:00-17:00)
    // Loop order: LDN_KZ, NY_KZ, LDN_SB, NY_SB, AM_SB — first match wins → NY_KZ
    const now = new Date('2026-07-06T08:30:00.000Z');
    const r = isInSession(now);
    expect(r.inSession).toBe(true);
    expect(['NY_KZ', 'NY_SB']).toContain(r.window);
  });

  it('matches London Kill Zone morning', () => {
    // 03:00 UTC = 10:00 WIB → LDN_SB start / inside LDN_KZ
    const now = new Date('2026-07-06T03:00:00.000Z');
    const r = isInSession(now);
    expect(r.inSession).toBe(true);
    expect(['LDN_KZ', 'LDN_SB']).toContain(r.window);
  });

  it('rejects out-of-window time (Asia afternoon dead zone)', () => {
    // 05:00 UTC = 12:00 WIB — LDN_KZ ends at 12:00 exclusive, NY not yet
    const now = new Date('2026-07-06T05:30:00.000Z'); // 12:30 WIB
    const r = isInSession(now);
    expect(r.inSession).toBe(false);
    expect(r.reason).toMatch(/out of Kill Zone/i);
  });

  it('allows payloadSession narrowing to NY_SB', () => {
    const now = new Date('2026-07-06T08:15:00.000Z'); // 15:15 WIB
    const r = isInSession(now, 'NY_SB');
    expect(r.inSession).toBe(true);
    expect(r.window).toBe('NY_SB');
    expect(r.silverBullet).toBe(true);
  });

  it('rejects Asia reference window under strict mode', () => {
    // 13:30 UTC = 20:30 WIB → AM_SB non-tradeable
    const now = new Date('2026-07-06T13:30:00.000Z');
    const r = isInSession(now, 'AM_SB');
    expect(r.inSession).toBe(false);
    expect(r.reason).toMatch(/not a trade window/i);
  });
});
