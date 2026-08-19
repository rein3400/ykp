/**
 * Telegram Reporting for Operational V1.
 * Sends HIGH/CRITICAL alerts + daily brief. Logs every delivery to
 * ops_telegram_delivery_log.
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * If not configured, messages are logged with status FAILED (no crash).
 * A Telegram failure NEVER breaks the request path.
 */
import { appendRows, readTab, findRow, updateRow, TABS } from '@/db/sheets';
import { nowTimestampWib } from './format';
import { nextSequentialIdSync } from './repo';

export interface TelegramMessage {
  sourceModule: string;
  sourceReferenceId: string;
  messageType: string;
  /**
   * Recipient selector. One of:
   *  - raw chat id (e.g. "551234001") — direct send
   *  - "user:<user_id>" — resolve telegram_id from the users tab
   *  - "role:<role>" — fan out to every active user with that role that has a telegram_id
   *  - "dept:<department>" — fan out to every active user in that department that has a telegram_id
   *  - "hod:<department>" — fan out to active HOD-level users in that department
   *  - "" — fall back to TELEGRAM_CHAT_ID (owner broadcast)
   */
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

/** Roles treated as head-of-department for `hod:<dept>` routing. */
const HOD_ROLES = new Set(['hod', 'outlet_manager', 'supervisor', 'brand_manager', 'manager']);

/**
 * Resolve a recipient selector to concrete Telegram chat ids.
 * Never throws — a missing/unresolvable target resolves to [].
 */
export async function resolveRecipients(recipient: string): Promise<string[]> {
  const r = (recipient || '').trim();
  if (!r) return [];
  if (r.startsWith('user:')) {
    const userId = r.slice(5).trim();
    if (!userId) return [];
    const u = await findRow(TABS.users, 'user_id', userId).catch(() => null);
    const tid = u?.row.telegram_id?.trim();
    return tid ? [tid] : [];
  }
  if (r.startsWith('role:')) {
    const role = r.slice(5).trim().toLowerCase();
    if (!role) return [];
    const users = await readTab<Record<string, string>>(TABS.users).catch(() => []);
    return users
      .filter((u) => (u.role || '').toLowerCase() === role && (u.active_status || 'active') === 'active')
      .map((u) => u.telegram_id?.trim())
      .filter((t): t is string => Boolean(t));
  }
  if (r.startsWith('dept:')) {
    const dept = r.slice(5).trim().toLowerCase();
    if (!dept) return [];
    const users = await readTab<Record<string, string>>(TABS.users).catch(() => []);
    return users
      .filter((u) => (u.department || '').toLowerCase() === dept && (u.active_status || 'active') === 'active')
      .map((u) => u.telegram_id?.trim())
      .filter((t): t is string => Boolean(t));
  }
  if (r.startsWith('hod:')) {
    const dept = r.slice(4).trim().toLowerCase();
    if (!dept) return [];
    const users = await readTab<Record<string, string>>(TABS.users).catch(() => []);
    return users
      .filter((u) =>
        (u.department || '').toLowerCase() === dept &&
        (u.active_status || 'active') === 'active' &&
        HOD_ROLES.has((u.role || '').toLowerCase())
      )
      .map((u) => u.telegram_id?.trim())
      .filter((t): t is string => Boolean(t));
  }
  // Raw chat id.
  return [r];
}

/**
 * Send a message to one or more recipients (fan-out). Logs every delivery to
 * ops_telegram_delivery_log. Never throws — a Telegram failure resolves to FAILED.
 */
export async function sendTelegram(msg: TelegramMessage): Promise<{ deliveryId: string; status: string; sent: number; failed: number }> {
  const deliveryId = nextSequentialIdSync('TDL');
  const now = nowTimestampWib();
  const token = process.env.TELEGRAM_BOT_TOKEN;

  const logDelivery = (chatId: string, status: string, messageId: string, errorMessage: string, sentAt: string, retryCount: number) =>
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

  if (!token) {
    await logDelivery(msg.recipient || '', 'FAILED', '', 'TELEGRAM_BOT_TOKEN not configured', '', 0);
    return { deliveryId, status: 'FAILED', sent: 0, failed: 1 };
  }

  // Resolve recipients. Empty selector → owner broadcast chat id.
  let chatIds = await resolveRecipients(msg.recipient);
  if (chatIds.length === 0 && !msg.recipient) {
    const fallback = (process.env.TELEGRAM_CHAT_ID || '').trim();
    if (fallback) chatIds = [fallback];
  }
  if (chatIds.length === 0) {
    await logDelivery(msg.recipient || '', 'FAILED', '', 'no resolvable recipient', '', 0);
    return { deliveryId, status: 'FAILED', sent: 0, failed: 1 };
  }

  let sent = 0;
  let failed = 0;
  for (const chatId of chatIds) {
    let lastError = '';
    let ok = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const messageId = await postToTelegram(token, chatId, msg.text);
        await logDelivery(chatId, 'SENT', messageId, '', now, attempt - 1);
        sent++;
        ok = true;
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Unknown error';
        if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
      }
    }
    if (!ok) {
      await logDelivery(chatId, 'FAILED', '', lastError, '', MAX_ATTEMPTS - 1);
      failed++;
    }
  }
  return { deliveryId, status: failed === 0 ? 'SENT' : 'PARTIAL', sent, failed };
}

// ── Telegram identity linking (P0) ────────────────────────────────────
const CODE_TTL_MS = 10 * 60_000;
const pendingCodes = new Map<string, { userId: string; expiresAt: number }>();

/** Generate a fresh 6-char link code bound to a user id. */
export function createLinkCode(userId: string): string {
  const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  pendingCodes.set(code, { userId, expiresAt: Date.now() + CODE_TTL_MS });
  for (const [k, v] of pendingCodes) if (v.expiresAt < Date.now()) pendingCodes.delete(k);
  return code;
}

/** Consume a link code and bind the Telegram chat id to the user. */
export async function consumeLinkCode(code: string, telegramChatId: string): Promise<string | null> {
  const entry = pendingCodes.get((code || '').trim().toUpperCase());
  if (!entry || entry.expiresAt < Date.now()) return null;
  pendingCodes.delete(code.trim().toUpperCase());
  const user = await findRow(TABS.users, 'user_id', entry.userId).catch(() => null);
  if (!user) return null;
  await updateRow(TABS.users, user.rowIndex, { ...user.row, telegram_id: telegramChatId }).catch(() => null);
  return entry.userId;
}

/** Look up the telegram chat id bound to a user id. */
export async function getTelegramIdForUser(userId: string): Promise<string> {
  const u = await findRow(TABS.users, 'user_id', userId).catch(() => null);
  return u?.row.telegram_id?.trim() ?? '';
}

/** Only HIGH/CRITICAL alerts are pushed (never MEDIUM/LOW). */
export function shouldPushAlert(severity: string): boolean {
  return severity === 'HIGH' || severity === 'CRITICAL';
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
