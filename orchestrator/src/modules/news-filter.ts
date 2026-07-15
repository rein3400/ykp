import { env } from '../config/env.js';
import { logSystem } from '../services/logger.js';

export interface NewsCheck {
  ok: boolean;
  provider: string;
  hint: string;
}

/**
 * News filter — ICT_TRADING_STRATEGY.md §7.
 * High-impact: no trade 30 min before/after (NEWS_WINDOW_MIN).
 *
 * Fail-closed when we cannot verify the calendar:
 * - stub provider → ok=false
 * - configured but unimplemented provider → ok=false (never silent-clear)
 * Real providers must query `news_events` and only then return ok=true.
 */
export async function isNewsClear(
  pair: string,
  _windowMin: number = env.NEWS_WINDOW_MIN
): Promise<NewsCheck> {
  if (!env.NEWS_FILTER_ENABLED) {
    return { ok: true, provider: 'disabled', hint: 'NEWS_FILTER_ENABLED=false' };
  }

  if (env.NEWS_PROVIDER === 'stub') {
    await logSystem('info', 'news-filter', `stub fails closed for ${pair}`, {
      provider: 'stub',
      pair
    });
    return {
      ok: false,
      provider: 'stub',
      hint: 'stub mode — cannot verify high-impact calendar; set NEWS_FILTER_ENABLED=false for paper or wire a real provider'
    };
  }

  // Future: query news_events where currency matches pair base/quote and |ts - now| < windowMin
  // Until implemented: FAIL CLOSED (do not clear trades we cannot see).
  await logSystem('warn', 'news-filter', `${env.NEWS_PROVIDER} not implemented — fail closed`, {
    pair,
    provider: env.NEWS_PROVIDER
  });
  return {
    ok: false,
    provider: env.NEWS_PROVIDER,
    hint: `${env.NEWS_PROVIDER} provider configured but query not implemented — fail closed`
  };
}
