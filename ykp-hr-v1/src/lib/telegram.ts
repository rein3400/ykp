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
import { appendRows, readTab, findRow, updateRow, TABS } from '@/db/sheets';
import { nowTimestampWib } from './format';
import { nextSequentialIdSync } from './repo';
import { sendViaGateway } from './notify-gateway';

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
   *  - "hod:<department>" — fan out to active HOD-level users (hod/outlet_manager/supervisor/brand_manager/manager) in that department
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

/** Employee bot token (webhook owner). Falls back to the legacy shared name. */
export function employeeBotToken(): string {
  return (process.env.TELEGRAM_EMPLOYEE_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
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

/** Roles treated as head-of-department for `hod:<dept>` routing. */
const HOD_ROLES = new Set(['hod', 'outlet_manager', 'supervisor', 'brand_manager', 'manager']);

/**
 * Send a message to one or more recipients (fan-out). Logs every delivery to
 * telegram_delivery_log. Never throws — a Telegram failure resolves to FAILED.
 */
export async function sendTelegram(msg: TelegramMessage): Promise<{ deliveryId: string; status: string; sent: number; failed: number }> {
  const deliveryId = nextSequentialIdSync('TDL');
  const now = nowTimestampWib();
  const token = employeeBotToken();

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
    await logDelivery(msg.recipient || '', 'FAILED', '', 'TELEGRAM_EMPLOYEE_BOT_TOKEN not configured', '', 0);
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
// A user logs into the app, requests a 6-char code, then DMs the Hermez bot
// with `/link <code>`. The bot calls back the app's link endpoint with the
// code + the user's Telegram chat id; the app binds chat_id ↔ user_id.

const CODE_TTL_MS = 10 * 60_000; // 10 minutes

/**
 * Generate a fresh 6-char link code bound to a user id. Persisted to the
 * telegram_link_codes tab/table so codes survive app restarts (in-memory
 * codes were lost on every redeploy).
 */
export async function createLinkCode(userId: string): Promise<string> {
  const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  await appendRows(TABS.telegramLinkCodes, [{
    code,
    user_id: userId,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    telegram_chat_id: '',
    consumed_at: '',
    created_at: nowTimestampWib(),
    division: 'hr'
  }]).catch(() => null);
  return code;
}

/**
 * Consume a link code and bind the Telegram chat id to the user.
 * Returns the bound user_id, or null if the code is invalid/expired/used.
 */
export async function consumeLinkCode(code: string, telegramChatId: string): Promise<string | null> {
  const c = (code || '').trim().toUpperCase();
  if (!c) return null;
  const found = await findRow(TABS.telegramLinkCodes, 'code', c).catch(() => null);
  if (!found) return null;
  const r = found.row as Record<string, string>;
  if (r.consumed_at || Date.parse(r.expires_at || '') < Date.now()) return null;
  await updateRow(TABS.telegramLinkCodes, found.rowNumber, {
    ...r,
    telegram_chat_id: telegramChatId,
    consumed_at: nowTimestampWib()
  }).catch(() => null);
  const user = await findRow(TABS.users, 'user_id', r.user_id).catch(() => null);
  if (!user) return null;
  await updateRow(TABS.users, user.rowNumber, { ...user.row, telegram_id: telegramChatId }).catch(() => null);
  return r.user_id;
}

/** Look up the telegram chat id bound to a user id (for inbound identity checks). */
export async function getTelegramIdForUser(userId: string): Promise<string> {
  const u = await findRow(TABS.users, 'user_id', userId).catch(() => null);
  return u?.row.telegram_id?.trim() ?? '';
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
    // Gateway first (management bot fan-out); legacy direct send as fallback.
    const viaGateway = await sendViaGateway({
      message_type: 'ALERT',
      source_module: sourceModule,
      message: formatAlertMessage(sourceModule, a)
    });
    if (viaGateway) return;
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
