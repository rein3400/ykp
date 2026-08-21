/**
 * POST /api/warehouse/notify/daily-brief
 * Protected by CRON_SECRET header (x-cron-secret or Authorization: Bearer).
 * External scheduler calls this at 22:00 WIB; composes the warehouse daily
 * brief from today's daily summary + open HIGH/CRITICAL alerts and sends it
 * via Telegram. Delivery is logged to telegram_delivery_log either way.
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { ok, unauthorized, handler } from '@/lib/http';
import { isCronAuthorized } from '@/lib/cron';
import { buildDailyBrief, sendTelegram, collectFraudWatchData, composeFraudWatchBlock } from '@/lib/telegram';
import { todayWib } from '@/lib/format';

export const POST = handler(async (req: NextRequest) => {
  if (!isCronAuthorized(req)) return unauthorized('Invalid or missing CRON_SECRET');

  const summaries = await readTab<Record<string, string>>(TABS.dailySummary);
  const today = todayWib();
  // No fallback to a stale summary: previously the last appended row was used
  // when today's summary was missing, sending days-old KPIs as "today's" brief.
  const summary = summaries.find((r) => r.date === today);
  if (!summary) return ok({ status: 'SKIPPED', reason: `no daily summary for ${today}` });

  const baseText = await buildDailyBrief('YKP Warehouse', summary);
  // Anti-fraud blueprint: fraud-watch block rides every daily brief.
  const fraudData = await collectFraudWatchData(summary.date || today);
  const text = baseText + composeFraudWatchBlock(fraudData, summary.date || today);

  const result = await sendTelegram({
    sourceModule: 'warehouse',
    sourceReferenceId: summary.summary_id || `daily-${summary.date || today}`,
    messageType: 'DAILY_BRIEF',
    recipient: '',
    text
  });
  return ok({ date: summary.date || today, ...result });
});
