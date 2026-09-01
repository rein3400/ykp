/**
 * POST /api/hr/notify/daily-brief
 * Protected by CRON_SECRET header (x-cron-secret or Authorization: Bearer).
 * External scheduler calls this at 22:00 WIB; composes the HR daily brief
 * from today's hr_daily_summary rows + open HIGH/CRITICAL hermes alerts and
 * sends it via Telegram. Delivery is logged to telegram_delivery_log either way.
 */
import { readTab, TABS } from '@/db/sheets';
import { ok, unauthorized, handler } from '@/lib/http';
import { isCronAuthorized } from '@/lib/cron';
import { sendViaGateway } from '@/lib/notify-gateway';
import { composeHrDailyBrief, sendTelegram } from '@/lib/telegram';
import { todayWib } from '@/lib/format';

export const POST = handler(async (req) => {
  if (!isCronAuthorized(req)) return unauthorized('Invalid or missing CRON_SECRET');

  const [summaries, alerts] = await Promise.all([
    readTab<Record<string, string>>(TABS.dailySummary),
    readTab<Record<string, string>>(TABS.hermezAlerts)
  ]);
  const today = todayWib();
  // Fall back to the most recent summary date when today has none yet.
  const dates = [...new Set(summaries.map((s) => s.date))].sort();
  const date = summaries.some((s) => s.date === today) ? today : dates[dates.length - 1];
  if (!date) return ok({ status: 'SKIPPED', reason: `no daily summary for ${today}` });

  const text = composeHrDailyBrief(
    date,
    summaries.filter((s) => s.date === date),
    alerts.filter((a) => a.status === 'OPEN' || a.status === 'ACK')
  );
  // Gateway first (management bot, dynamic recipients); legacy direct send
  // as fallback when the gateway is disabled or unreachable.
  if (await sendViaGateway({ message_type: 'DAILY_BRIEF', source_module: 'hr', message: text })) {
    return ok({ date, status: 'SENT', via: 'gateway' });
  }
  const result = await sendTelegram({
    sourceModule: 'hr',
    sourceReferenceId: `daily-${date}`,
    messageType: 'DAILY_BRIEF',
    recipient: '',
    text
  });
  return ok({ date, ...result });
});
