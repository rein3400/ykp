/**
 * Telegram reporting for finance alerts.
 * Sends only HIGH/CRITICAL alerts + daily brief. Never raw transactions.
 * Logs every delivery to telegram_delivery_log (Revisi #25).
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * If not configured, messages are logged with status FAILED (no crash).
 * A Telegram failure NEVER breaks the request path: every caller-facing
 * helper here resolves without throwing.
 */
import { appendRows, updateRow, findRow, TABS } from '@/db/sheets';
import { nowTimestampWib, formatIdr } from './format';
import { nextSequentialIdSync } from './id-gen';
import { getOwnerChatId } from './settings';
import { guardedUpdateRow, ConcurrentUpdateError } from './concurrency';

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
  const chatId = msg.recipient || (await getOwnerChatId());

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

/** Build the finance section of a daily brief from fin_daily_summary rows. */
export function buildFinanceDailyBrief(date: string, summaries: Record<string, string>[], alerts: Record<string, string>[]): string {
  const totalRevenue = summaries.reduce((s, r) => s + Number(r.net_sales || 0), 0);
  const totalExpense = summaries.reduce((s, r) => s + Number(r.total_expense || 0), 0);
  const totalSupplier = summaries.reduce((s, r) => s + Number(r.supplier_cost || 0), 0);
  const totalSurplus = summaries.reduce((s, r) => s + Number(r.estimated_surplus || 0), 0);
  const totalUnpaid = summaries.reduce((s, r) => s + Number(r.unpaid_supplier || 0), 0);

  const lines: string[] = [];
  lines.push('<b>YKP FINANCE DAILY BRIEF</b>');
  lines.push(`${date}`);
  lines.push('');
  lines.push(`Total Net Sales: ${formatIdr(totalRevenue)}`);
  lines.push(`Total Expense: ${formatIdr(totalExpense)}`);
  lines.push(`Supplier Cost: ${formatIdr(totalSupplier)}`);
  lines.push(`Estimasi Surplus Kas: ${formatIdr(totalSurplus)}`);
  lines.push(`Outstanding Supplier: ${formatIdr(totalUnpaid)}`);
  const high = alerts.filter((a) => shouldPushAlert(a.severity));
  if (high.length > 0) {
    lines.push('');
    lines.push('<b>ALERT HIGH/CRITICAL:</b>');
    for (const a of high.slice(0, 5)) lines.push(`• ${a.title} (${a.severity})`);
  }
  return lines.join('\n');
}

// ── Telegram identity linking (P0) ────────────────────────────────────
const CODE_TTL_MS = 10 * 60_000;
const DIVISION = 'finance';

/** Generate a fresh 6-char link code bound to a user id, persisted to Sheets. */
export async function createLinkCode(userId: string): Promise<string> {
  const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  await appendRows(TABS.telegramLinkCodes, [{
    code,
    user_id: userId,
    expires_at: String(Date.now() + CODE_TTL_MS),
    telegram_chat_id: '',
    consumed_at: '',
    created_at: nowTimestampWib(),
    division: DIVISION
  }]).catch(() => null);
  return code;
}

/** Consume a link code and bind the Telegram chat id to the user. */
export async function consumeLinkCode(code: string, telegramChatId: string): Promise<string | null> {
  const normalized = (code || '').trim().toUpperCase();
  const codeRow = await findRow(TABS.telegramLinkCodes, 'code', normalized).catch(() => null);
  if (!codeRow) return null;
  const entry = codeRow.row;
  if (entry.consumed_at) return null;
  const expiresAt = Number(entry.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  const userId = entry.user_id;
  const user = await findRow(TABS.users, 'user_id', userId).catch(() => null);
  if (!user) return null;
  await updateRow(TABS.users, user.rowNumber, { ...user.row, telegram_id: telegramChatId }).catch(() => null);
  // Bug #12: race-free consume via guardedUpdateRow on `consumed_at`. Two
  // concurrent consumers of the same code both read consumed_at='' — the guard
  // re-reads and only the first wins (consumed_at moves from '' to a timestamp);
  // the second throws ConcurrentUpdateError → returns null instead of binding
  // a second chat id.
  const nextCodeRow = { ...entry, telegram_chat_id: telegramChatId, consumed_at: nowTimestampWib() };
  try {
    await guardedUpdateRow(TABS.telegramLinkCodes, 'code', normalized, codeRow, nextCodeRow, 'consumed_at');
  } catch (e) {
    if (e instanceof ConcurrentUpdateError) return null;
    throw e;
  }
  return userId;
}
