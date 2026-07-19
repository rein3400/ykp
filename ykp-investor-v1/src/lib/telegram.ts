/**
 * Telegram Reporting for Investor. Sends only HIGH/CRITICAL alerts + daily brief.
 * Logs every delivery to telegram_delivery_log.
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * If not configured, messages are logged with status FAILED (no crash).
 * A Telegram failure NEVER breaks the request path: every caller-facing
 * helper here resolves without throwing.
 */
import { randomBytes } from 'crypto';
import { appendRows, TABS } from '@/db/sheets';
import { nowTimestampWib, formatIdr } from './format';

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

/** Race-free unique ID of shape TDL-{ts36}{rand6}. */
function nextDeliveryId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `TDL-${ts}${rand}`;
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
  const deliveryId = nextDeliveryId();
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

/**
 * Delivery-log dedupe for the cron-time alert push (investor has no internal
 * alert-creation site, so "newly created" is decided against prior delivery
 * attempts): true when an ALERT delivery for this alert was already logged
 * (SENT or FAILED — failed deliveries are not retried to avoid log storms).
 */
export function alertAlreadyDelivered(deliveries: Record<string, string>[], alertId: string): boolean {
  return deliveries.some(
    (d) => d.source_reference_id === alertId && d.message_type === 'ALERT' &&
      (d.status === 'SENT' || d.status === 'FAILED')
  );
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

/** Compose the investor daily brief from an investor_daily_summary row + alerts. Pure. */
export function composeInvestorDailyBrief(
  date: string,
  summary: Record<string, string> | null,
  alerts: Record<string, string>[]
): string {
  const s = summary ?? {};
  const highCritical = alerts.filter(
    (a) => shouldPushAlert(a.severity) && a.status !== 'CLOSED' && a.status !== 'RESOLVED'
  );

  const lines: string[] = [];
  lines.push('<b>YKP INVESTOR DAILY BRIEF</b>');
  lines.push(date);
  lines.push('');
  lines.push(`Total Revenue: ${formatIdr(s.total_revenue)}`);
  lines.push(`Total Profit: ${formatIdr(s.total_profit)}`);
  lines.push(`Total Capital: ${formatIdr(s.total_capital)}`);
  lines.push(`Active Investors: ${s.active_investors || '0'}`);
  lines.push(`Dividend Declared: ${formatIdr(s.dividend_declared)}`);
  if (s.growth_pct) lines.push(`Growth: ${s.growth_pct}%`);
  if (highCritical.length > 0) {
    lines.push('');
    lines.push('<b>CRITICAL/HIGH ALERTS:</b>');
    for (const a of highCritical.slice(0, 5)) {
      lines.push(`• ${a.message} (${a.severity})`);
    }
  }
  return lines.join('\n');
}
