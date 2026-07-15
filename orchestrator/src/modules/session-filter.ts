import { KILL_ZONE_WINDOWS } from '../config/constants.js';
import { env } from '../config/env.js';

export interface SessionCheck {
  inSession: boolean;
  strict: boolean;
  window?: string;
  reason: string;
  /** True when inside a Silver Bullet sub-window (higher quality). */
  silverBullet: boolean;
}

function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(':').map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function toMinutes({ h, m }: { h: number; m: number }): number {
  return h * 60 + m;
}

type WindowEntry = {
  label: string;
  start: string;
  end: string;
  tradeable?: boolean;
};

/**
 * Kill Zone filter — ICT_TRADING_STRATEGY.md §6.
 * Tradeable only inside London/NY Kill Zones (and SB sub-windows).
 * Asia reference window is never tradeable under strict mode.
 * If `payloadSession` is supplied (e.g. "LDN_SB"), narrow check to that key.
 */
export function isInSession(now: Date, payloadSession?: string): SessionCheck {
  const strict = env.SESSION_STRICT;
  const wib = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);
  const [hh, mm] = wib.split(':').map(Number);
  const nowMin = (hh ?? 0) * 60 + (mm ?? 0);

  const windows = Object.entries(KILL_ZONE_WINDOWS) as [string, WindowEntry][];

  for (const [key, w] of windows) {
    if (payloadSession && key !== payloadSession) continue;
    const start = toMinutes(parseHHMM(w.start));
    const end = toMinutes(parseHHMM(w.end));
    if (nowMin >= start && nowMin < end) {
      const tradeable = w.tradeable !== false;
      // Asia / non-tradeable windows never open trades
      if (!tradeable) {
        if (!strict) {
          return {
            inSession: true,
            strict,
            window: key,
            silverBullet: false,
            reason: `non-tradeable window bypass (non-strict, ${w.label})`
          };
        }
        return {
          inSession: false,
          strict,
          window: key,
          silverBullet: false,
          reason: `${w.label} is not a trade window (Asia range / reference only)`
        };
      }
      const silverBullet = key.endsWith('_SB');
      return {
        inSession: true,
        strict,
        window: key,
        silverBullet,
        reason: `in ${w.label} (${w.start}-${w.end} WIB)`
      };
    }
  }

  // Non-strict: skip window gate (paper/backtest/smoke mode).
  if (!strict) {
    return {
      inSession: true,
      strict,
      silverBullet: false,
      reason: `session window bypass (non-strict, current WIB=${wib})`
    };
  }

  return {
    inSession: false,
    strict,
    silverBullet: false,
    reason: `out of Kill Zone windows (current WIB=${wib})`
  };
}
