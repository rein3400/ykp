/**
 * POST /api/investor/notify/daily-brief
 * Protected by CRON_SECRET header (x-cron-secret or Authorization: Bearer).
 * External scheduler calls this at 22:00 WIB.
 *
 * Investor has no internal alert-creation site, so this endpoint hosts both
 * notification behaviors:
 *  1. Immediate push for OPEN HIGH/CRITICAL alerts not yet delivered
 *     (dedupe against telegram_delivery_log ALERT entries).
 *  2. The composed daily brief from the latest investor_daily_summary row.
 * Every delivery is logged to telegram_delivery_log.
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { ok, unauthorized, handler } from '@/lib/http';
import { isCronAuthorized } from '@/lib/cron';
import {
  alertAlreadyDelivered, composeInvestorDailyBrief,
  pushAlertNotification, sendTelegram, shouldPushAlert
} from '@/lib/telegram';
import { todayWib } from '@/lib/format';

/** MOU section for the daily brief: expired + expiring within 30 days. */
function composeMouExpirySection(
  documents: Record<string, string>[],
  investors: Record<string, string>[],
  today: string
): string {
  const nameOf = (id: string) =>
    investors.find((i) => i.investor_id === id)?.investor_name ?? id;
  const WARN_DAYS = 30;
  const lines: string[] = [];
  for (const d of documents.filter((x) => x.doc_type === 'MOU' && x.expiry_date)) {
    const days = Math.floor((Date.parse(d.expiry_date) - Date.parse(today)) / 86400000);
    if (days < 0) lines.push(`• ${nameOf(d.investor_id)} — EXPIRED ${d.expiry_date} (${-days} hari lalu)`);
    else if (days <= WARN_DAYS) lines.push(`• ${nameOf(d.investor_id)} — berakhir ${d.expiry_date} (${days} hari lagi)`);
  }
  if (lines.length === 0) return '';
  return `\n\n<b>MOU EXPIRY:</b>\n${lines.slice(0, 10).join('\n')}`;
}

export const POST = handler(async (req: NextRequest) => {
  if (!isCronAuthorized(req)) return unauthorized('Invalid or missing CRON_SECRET');

  const [summaries, alerts, deliveries, documents, investors] = await Promise.all([
    readTab<Record<string, string>>(TABS.summary),
    readTab<Record<string, string>>(TABS.hermezAlerts),
    readTab<Record<string, string>>(TABS.telegramDeliveryLog),
    readTab<Record<string, string>>(TABS.documents),
    readTab<Record<string, string>>(TABS.investors)
  ]);
  const today = todayWib();

  // 1. Immediate push for OPEN HIGH/CRITICAL alerts never delivered before.
  const pendingAlerts = alerts.filter(
    (a) => (a.status === 'OPEN' || a.status === 'ACK') &&
      shouldPushAlert(a.severity) &&
      !alertAlreadyDelivered(deliveries, a.alert_id)
  );
  const alertPushes: Array<{ alert_id: string; severity: string }> = [];
  for (const a of pendingAlerts) {
    await pushAlertNotification('investor', {
      alertId: a.alert_id,
      alertType: a.alert_type,
      severity: a.severity,
      title: a.message,
      message: a.message,
      date: a.date
    });
    alertPushes.push({ alert_id: a.alert_id, severity: a.severity });
  }

  // 2. Daily brief from today's (or the latest) summary row.
  const dates = [...new Set(summaries.map((s) => s.date))].sort();
  const date = summaries.some((s) => s.date === today) ? today : dates[dates.length - 1];
  const summary = summaries.filter((s) => s.date === date).pop() ?? null;
  if (!date) return ok({ status: 'SKIPPED', reason: `no daily summary for ${today}`, alert_pushes: alertPushes.length });

  const text = composeInvestorDailyBrief(date, summary, alerts) + composeMouExpirySection(documents, investors, today);
  const result = await sendTelegram({
    sourceModule: 'investor',
    sourceReferenceId: summary?.summary_id || `daily-${date}`,
    messageType: 'DAILY_BRIEF',
    recipient: '',
    text
  });
  return ok({ date, alert_pushes: alertPushes.length, alerts: alertPushes, ...result });
});
