/**
 * Telegram Reporting for HR. Sends only HIGH/CRITICAL alerts + daily brief.
 * Never one message per attendance change. Logs every delivery to
 * telegram_delivery_log.
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * If not configured, messages are logged with status FAILED (no crash).
 * A Telegram failure NEVER breaks the request path: every caller-facing
 * helper here resolves without throwing.
 */
import { appendRows, readTab, TABS } from '@/db/sheets';
import { nowTimestampWib } from './format';
import { nextSequentialIdSync } from './repo';

export interface TelegramMessage {
  sourceModule: string;
  sourceReferenceId: string;
  messageType: string;
  recipient: string;
  text: string;
}

/** One initial attempt + one retry with a short backoff. */
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postToTelegram(token: string, chatId: string, text: string): Promise<string> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'Telegram API error');
  return String(data.result?.message_id ?? '');
}

export async function sendTelegram(msg: TelegramMessage): Promise<{ deliveryId: string; status: string }> {
  const deliveryId = nextSequentialIdSync('TDL');
  const now = nowTimestampWib();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = msg.recipient || process.env.TELEGRAM_CHAT_ID;

  const logDelivery = (status: string, messageId: string, errorMessage: string, sentAt: string, retryCount: number) =>
    appendRows(TABS.telegramDeliveryLog, [{
      delivery_id: deliveryId,
      source_module: msg.sourceModule,
      source_reference_id: msg.sourceReferenceId,
      message_type: msg.messageType,
      recipient: chatId ?? '',
      message_id: messageId,
      status,
      retry_count: String(retryCount),
      sent_at: sentAt,
      error_message: errorMessage,
      created_at: now
    }]).catch(() => null);

  if (!token || !chatId) {
    await logDelivery('FAILED', '', 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured', '', 0);
    return { deliveryId, status: 'FAILED' };
  }

  let lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const messageId = await postToTelegram(token, chatId, msg.text);
      await logDelivery('SENT', messageId, '', now, attempt - 1);
      return { deliveryId, status: 'SENT' };
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Unknown error';
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  await logDelivery('FAILED', '', lastError, '', MAX_ATTEMPTS - 1);
  return { deliveryId, status: 'FAILED' };
}

/** Only HIGH/CRITICAL alerts are pushed (never MEDIUM/LOW). */
export function shouldPushAlert(severity: string): boolean {
  return severity === 'HIGH' || severity === 'CRITICAL';
}

/** Dedupe decision: push only newly created alerts, never re-upserted ones. */
export function shouldNotifyNewAlert(isNewlyCreated: boolean, severity: string): boolean {
  return isNewlyCreated && shouldPushAlert(severity);
}

export interface AlertPushInput {
  alertId: string;
  alertType?: string;
  severity: string;
  title: string;
  message?: string;
  outletName?: string;
  date?: string;
}

/** Format the immediate HIGH/CRITICAL alert push message (HTML, Telegram parse_mode). */
export function formatAlertMessage(sourceLabel: string, a: AlertPushInput): string {
  const lines: string[] = [];
  lines.push(`<b>[${a.severity}] ${a.title}</b>`);
  const meta = [a.outletName, a.date].filter((v) => Boolean(v)).join(' — ');
  if (meta) lines.push(meta);
  if (a.message && a.message !== a.title) lines.push(a.message);
  lines.push(`<i>${sourceLabel}</i>`);
  return lines.join('\n');
}

/**
 * Fire-and-log push for a newly created alert. Never throws and never
 * blocks on failure — safe to call from any request path.
 */
export async function pushAlertNotification(sourceModule: string, a: AlertPushInput): Promise<void> {
  if (!shouldPushAlert(a.severity)) return;
  try {
    await sendTelegram({
      sourceModule,
      sourceReferenceId: a.alertId,
      messageType: 'ALERT',
      recipient: '',
      text: formatAlertMessage(sourceModule, a)
    });
  } catch {
    // sendTelegram already logs the failure; swallow to protect the request path.
  }
}

/** Compose the HR daily brief from hr_daily_summary rows + hermes alerts. Pure. */
export function composeHrDailyBrief(
  date: string,
  summaries: Record<string, string>[],
  alerts: Record<string, string>[]
): string {
  const sum = (key: string) => summaries.reduce((s, r) => s + Number(r[key] || 0), 0);
  const highCritical = alerts.filter(
    (a) => shouldPushAlert(a.severity) && a.status !== 'CLOSED' && a.status !== 'RESOLVED'
  );

  const lines: string[] = [];
  lines.push('<b>YKP HR DAILY BRIEF</b>');
  lines.push(date);
  lines.push('');
  lines.push(`Outlets: ${summaries.length}`);
  lines.push(`Present: ${sum('staff_present')} / ${sum('scheduled_staff')} scheduled (total staff ${sum('total_staff')})`);
  lines.push(`Late: ${sum('staff_late')} (${sum('total_late_minutes')} min) | Absent: ${sum('staff_absent')} | Leave: ${sum('staff_leave')}`);
  lines.push(`Incomplete checkout: ${sum('incomplete_attendance')} | Shift shortage: ${sum('shift_shortage')}`);
  lines.push(`Overtime: ${sum('overtime_hours')} jam | Payroll issues: ${sum('payroll_issue_count')}`);

  const issues = summaries.filter((s) => s.major_hr_issue);
  if (issues.length > 0) {
    lines.push('');
    lines.push('<b>Major Issues:</b>');
    for (const s of issues.slice(0, 5)) {
      lines.push(`• ${s.outlet_name || s.outlet_id}: ${s.major_hr_issue}`);
    }
  }
  if (highCritical.length > 0) {
    lines.push('');
    lines.push('<b>CRITICAL/HIGH ALERTS:</b>');
    for (const a of highCritical.slice(0, 5)) {
      lines.push(`• ${a.message} (${a.severity})`);
    }
  }
  return lines.join('\n');
}

/** Build the HR daily brief for a date, reading summary + alert tabs. */
export async function buildHrDailyBrief(date: string): Promise<string> {
  const [summaries, alerts] = await Promise.all([
    readTab<Record<string, string>>(TABS.dailySummary),
    readTab<Record<string, string>>(TABS.hermezAlerts)
  ]);
  return composeHrDailyBrief(date, summaries.filter((s) => s.date === date), alerts);
}
