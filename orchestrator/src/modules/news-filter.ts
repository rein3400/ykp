import { env } from '../config/env.js';
import { logSystem } from '../services/logger.js';

export interface NewsCheck {
  ok: boolean;
  provider: string;
  hint: string;
}

/**
 * News filter. Stub mode: FAILS CLOSED (ok=false) because we cannot verify
 * high-impact calendar events. Real providers (forexfactory/investing) will
 * query the `news_events` table once integrated.
 */
export async function isNewsClear(pair: string, _windowMin: number = env.NEWS_WINDOW_MIN): Promise<NewsCheck> {
  if (!env.NEWS_FILTER_ENABLED) {
    return { ok: true, provider: 'disabled', hint: 'NEWS_FILTER_ENABLED=false' };
  }
  if (env.NEWS_PROVIDER === 'stub') {
    await logSystem('info', 'news-filter', `stub fails closed for ${pair}`, { provider: 'stub', pair });
    // ponytail: return ok=true once a real NEWS_PROVIDER is wired; until then,
    // refuse to trade during windows we cannot see.
    return { ok: false, provider: 'stub', hint: 'news filter disabled in stub mode' };
  }

  // Future: query news_events where currency matches pair base/quote and |ts - now| < windowMin
  await logSystem('warn', 'news-filter', `${env.NEWS_PROVIDER} provider not yet implemented, clearing`, { pair });
  return { ok: true, provider: env.NEWS_PROVIDER, hint: 'provider configured but query not implemented' };
}