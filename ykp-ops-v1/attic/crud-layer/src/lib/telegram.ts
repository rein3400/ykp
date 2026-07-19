/**
 * Telegram Reporting. Sends only HIGH/CRITICAL alerts + daily brief.
 * Logs every delivery to telegram_delivery_log.
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * If not configured, messages are queued with status FAILED (no crash).
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
  const meta = [a.outletName, a.date].filter((v) => Boolean(v)).join(' ΓÇö ');
  if (meta) lines.push(meta);
  if (a.message && a.message !== a.title) lines.push(a.message);
  lines.push(`<i>${sourceLabel}</i>`);
  return lines.join('\n');
}

/**
 * Fire-and-log push for a newly created alert. Never throws and never
 * blocks on failure ΓÇö safe to call from any request path.
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

/** Compose the ops daily brief from an ops_daily_summary row + alert rows. Pure. */
export function composeOpsDailyBrief(
  outletName: string,
  summary: Record<string, string>,
  alerts: Record<string, string>[]
): string {
  const highCritical = alerts.filter(
    (a) => a.outlet_id === summary.outlet_id && shouldPushAlert(a.severity) && a.status === 'OPEN'
  );

  const lines: string[] = [];
  lines.push(`<b>YKP OPS DAILY BRIEF</b>`);
  lines.push(`${outletName} ΓÇö ${summary.date}`);
  lines.push('');
  lines.push(`Opening: ${summary.opening_status} (${summary.opening_completion_percentage}%)`);
  lines.push(`Incident: ${summary.incident_count} (HIGH/CRITICAL: ${summary.high_severity_incident})`);
  lines.push(`Waste Value: ${formatRp(summary.waste_value)}`);
  lines.push(`Cash Difference: ${formatRp(summary.cash_difference)}`);
  lines.push(`Closing: ${summary.closing_status}`);
  lines.push(`Open Actions: ${summary.open_action_count}`);
  if (summary.major_ops_issue) {
    lines.push('');
    lines.push(`<b>Major Issue:</b>`);
    lines.push(summary.major_ops_issue);
  }
  if (summary.recommended_action) {
    lines.push('');
    lines.push(`<b>Recommended Action:</b>`);
    lines.push(summary.recommended_action);
  }
  if (highCritical.length > 0) {
    lines.push('');
    lines.push(`<b>CRITICAL/HIGH ALERTS:</b>`);
    for (const a of highCritical.slice(0, 5)) {
      lines.push(`ΓÇó ${a.title} (${a.severity})`);
    }
  }

  return lines.join('\n');
}

/** Build daily brief from an ops_daily_summary row + open HIGH/CRITICAL alerts. */
export async function buildOpsDailyBrief(outletName: string, summary: Record<string, string>): Promise<string> {
  const alerts = await readTab<Record<string, string>>(TABS.alertLog);
  return composeOpsDailyBrief(outletName, summary, alerts);
}

export function formatRp(n: string): string {
  const v = Number(n || 0);
  if (!v) return 'Rp 0';
  return `Rp ${new Intl.NumberFormat('id-ID').format(v)}`;
}
