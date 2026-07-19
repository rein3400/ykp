/**
 * POST /api/ops/notify/daily-brief
 * Protected by CRON_SECRET header (x-cron-secret or Authorization: Bearer).
 * External scheduler calls this at 22:00 WIB; composes the ops daily brief
 * per outlet from today's ops_daily_summary rows + open HIGH/CRITICAL alerts
 * and sends them via Telegram. Deliveries are logged to telegram_delivery_log.
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { ok, unauthorized, handler } from '@/lib/http';
import { isCronAuthorized } from '@/lib/cron';
import { composeOpsDailyBrief, sendTelegram } from '@/lib/telegram';
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

  const daySummaries = summaries.filter((s) => s.date === date);
  const results: Array<{ outlet_id: string; deliveryId: string; status: string }> = [];
  for (const summary of daySummaries) {
    const text = composeOpsDailyBrief(summary.outlet_name || summary.outlet_id, summary, alerts);
    const r = await sendTelegram({
      sourceModule: 'ops',
      sourceReferenceId: summary.summary_id || `daily-${date}-${summary.outlet_id}`,
      messageType: 'DAILY_BRIEF',
      recipient: '',
      text
    });
    results.push({ outlet_id: summary.outlet_id, ...r });
  }
  return ok({ date, outlets: results.length, results });
});
