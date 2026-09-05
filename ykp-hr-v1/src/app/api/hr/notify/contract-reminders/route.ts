/**
 * POST /api/hr/notify/contract-reminders
 * Protected by CRON_SECRET header (x-cron-secret or Authorization: Bearer).
 * External scheduler (systemd timer / cron, daily ~08:00 WIB) calls this;
 * it scans master_employee for probation-end (2 bln) and contract-end
 * (14 bln total) deadlines and notifies HR + Owner via Telegram.
 * Delivery is logged to telegram_delivery_log either way.
 */
import { readTab, TABS } from '@/db/sheets';
import { ok, unauthorized, handler } from '@/lib/http';
import { isCronAuthorized } from '@/lib/cron';
import { sendViaGateway } from '@/lib/notify-gateway';
import { sendTelegram } from '@/lib/telegram';
import {
  contractReminders,
  composeReminderText,
  type EmployeeLite
} from '@/lib/contract-reminders';
import { todayWib } from '@/lib/format';

export const POST = handler(async (req) => {
  if (!isCronAuthorized(req)) return unauthorized('Invalid or missing CRON_SECRET');

  const today = todayWib();
  const employees = await readTab<EmployeeLite>(TABS.employees);
  const items = contractReminders(employees, today);
  if (items.length === 0) return ok({ date: today, status: 'SKIPPED', reason: 'no upcoming deadlines' });

  const text = composeReminderText(today, items);
  // Gateway first (management bot, dynamic recipients); legacy direct fan-out
  // to HR + Owner roles as fallback.
  if (await sendViaGateway({ message_type: 'CONTRACT_REMINDER', source_module: 'hr', message: text })) {
    return ok({ date: today, status: 'SENT', via: 'gateway', count: items.length });
  }
  const results = [];
  for (const recipient of ['role:hr_admin', 'role:owner']) {
    results.push(
      await sendTelegram({
        sourceModule: 'hr',
        sourceReferenceId: `contract-${today}`,
        messageType: 'CONTRACT_REMINDER',
        recipient,
        text
      })
    );
  }
  const sent = results.reduce((s, r) => s + r.sent, 0);
  return ok({ date: today, status: sent > 0 ? 'SENT' : 'FAILED', count: items.length, sent });
});
