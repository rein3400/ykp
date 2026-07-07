import { SILVER_BULLET_WINDOWS } from '../config/constants.js';
import { env } from '../config/env.js';

export interface SessionCheck {
  inSession: boolean;
  strict: boolean;
  window?: string;
  reason: string;
}

function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(':').map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function toMinutes({ h, m }: { h: number; m: number }): number {
  return h * 60 + m;
}

/**
 * Determine if `now` (in Asia/Jakarta) falls inside any Silver Bullet window.
 * If `payloadSession` is supplied (e.g. "LDN_SB"), narrow check to that window.
 */
export function isInSession(now: Date, payloadSession?: string): SessionCheck {
  const strict = env.SESSION_STRICT;
  // Format WIB HH:MM
  const wib = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);
  const [hh, mm] = wib.split(':').map(Number);
  const nowMin = (hh ?? 0) * 60 + (mm ?? 0);

  const windows = Object.entries(SILVER_BULLET_WINDOWS) as [keyof typeof SILVER_BULLET_WINDOWS, typeof SILVER_BULLET_WINDOWS[keyof typeof SILVER_BULLET_WINDOWS]][];

  for (const [key, w] of windows) {
    if (payloadSession && key !== payloadSession) continue;
    const start = toMinutes(parseHHMM(w.start));
    const end = toMinutes(parseHHMM(w.end));
    if (nowMin >= start && nowMin < end) {
      return { inSession: true, strict, window: key, reason: `in ${w.label} (${w.start}-${w.end})` };
    }
  }

  // ponytail: ceiling = strict mode per-spec; upgrade path = per-pair schedule overrides.
  // Non-strict: skip window gate (paper/backtest/smoke mode).
  if (!strict) {
    return { inSession: true, strict, reason: `session window bypass (non-strict, current WIB=${wib})` };
  }

  return { inSession: false, strict, reason: `out of silver bullet windows (current WIB=${wib})` };
}
