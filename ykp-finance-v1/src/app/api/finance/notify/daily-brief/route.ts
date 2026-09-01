/**
 * POST /api/finance/notify/daily-brief
 * Protected by CRON_SECRET header (x-cron-secret or Authorization: Bearer).
 * External scheduler calls this at 22:00 WIB; composes the finance daily
 * brief from today's fin_daily_summary rows + open HIGH/CRITICAL alerts and
 * sends it via Telegram. Delivery is logged to telegram_delivery_log either way.
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { ok, unauthorized, handler } from '@/lib/http';
import { isCronAuthorized } from '@/lib/cron';
import { buildFinanceDailyBrief, sendTelegram } from '@/lib/telegram';
import { sendViaGateway } from '@/lib/notify-gateway';
import { todayWib } from '@/lib/format';

export const POST = handler(async (req: NextRequest) => {
  if (!isCronAuthorized(req)) return unauthorized('Invalid or missing CRON_SECRET');

  const [summaries, alerts] = await Promise.all([
    readTab<Record<string, string>>(TABS.dailySummary),
    readTab<Record<string, string>>(TABS.alertLog)
  ]);
  const today = todayWib();
  // Fall back to the most recent summary date when today has none yet.
  const dates = [...new Set(summaries.map((s) => s.date))].sort();
  const date = summaries.some((s) => s.date === today) ? today : dates[dates.length - 1];
  if (!date) return ok({ status: 'SKIPPED', reason: `no daily summary for ${today}` });

  const text = buildFinanceDailyBrief(
    date,
    summaries.filter((s) => s.date === date),
    // Bug #11: scope alerts to the brief date so stale OPEN/ACK alerts from
    // weeks ago do not leak into the "daily" brief.
    alerts.filter((a) => (a.status === 'OPEN' || a.status === 'ACK') && (a.date ?? '') === date)
  );
  // Gateway first (management bot, dynamic recipients); legacy direct send
  // as fallback when the gateway is disabled or unreachable.
  if (await sendViaGateway({ message_type: 'DAILY_BRIEF', source_module: 'finance', message: text })) {
    return ok({ date, status: 'SENT', via: 'gateway' });
  }
  const result = await sendTelegram({
    sourceModule: 'finance',
    sourceReferenceId: `daily-${date}`,
    messageType: 'DAILY_BRIEF',
    recipient: '',
    text
  });
  return ok({ date, ...result });
});
