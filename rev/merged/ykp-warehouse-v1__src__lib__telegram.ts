/**
 * Telegram Reporting per brief -—23.
 * Sends only HIGH/CRITICAL alerts + daily brief. Never raw stock changes.
 * Logs every delivery to telegram_delivery_log.
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * If not configured, messages are queued with status FAILED (no crash).
 */
import { appendRows, readTab, updateRow, findRow, TABS } from '@/db/sheets';
import { nowTimestampWib, formatDateWib } from './format';
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
   *  - "" — fall back to TELEGRAM_CHAT_ID (owner broadcast)
   */
  recipient: string;
  text: string;
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

export async function sendTelegram(
  msg: TelegramMessage,
): Promise<{ deliveryId: string; status: string; error?: string; messageId?: string; sent?: number; failed?: number }> {
  const deliveryId = nextSequentialIdSync('TDL');
  const now = nowTimestampWib();
  // Strip BOM / whitespace — Vercel env set via Windows PowerShell pipe can inject U+FEFF.
  const clean = (v: string | undefined) => (v ?? '').replace(/^﻿/, '').trim();
  const token = clean(process.env.TELEGRAM_BOT_TOKEN);

  const logDelivery = (chatId: string, status: string, messageId: string, errorMessage: string, sentAt: string) =>
    appendRows(TABS.telegramDeliveryLog, [{
      delivery_id: deliveryId,
      source_module: msg.sourceModule,
      source_reference_id: msg.sourceReferenceId,
      message_type: msg.messageType,
      recipient: chatId ?? '',
      message_id: messageId,
      status,
      retry_count: '0',
      sent_at: sentAt,
      error_message: errorMessage,
      created_at: now
    }]).catch(() => null);

  if (!token) {
    const error = 'TELEGRAM_BOT_TOKEN not configured';
    await logDelivery(msg.recipient || '', 'FAILED', '', error, '');
    return { deliveryId, status: 'FAILED', error, sent: 0, failed: 1 };
  }

  // Resolve recipients. Empty selector → owner broadcast chat id.
  let chatIds = await resolveRecipients(msg.recipient);
  if (chatIds.length === 0 && !msg.recipient) {
    const fallback = clean(process.env.TELEGRAM_CHAT_ID);
    if (fallback) chatIds = [fallback];
  }
  if (chatIds.length === 0) {
    const error = 'no resolvable recipient';
    await logDelivery(msg.recipient || '', 'FAILED', '', error, '');
    return { deliveryId, status: 'FAILED', error, sent: 0, failed: 1 };
  }

  let sent = 0;
  let failed = 0;
  let lastMessageId = '';
  let lastError = '';
  for (const chatId of chatIds) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg.text, parse_mode: 'HTML' }),
        // 10s cap so a hanging Telegram API can't stall the route/cron to the
        // platform timeout.
        signal: AbortSignal.timeout(10000)
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.description || 'Telegram API error');
      const messageId = String(data.result?.message_id ?? '');
      await logDelivery(chatId, 'SENT', messageId, '', now);
      sent++;
      lastMessageId = messageId;
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Unknown error';
      await logDelivery(chatId, 'FAILED', '', lastError, '');
      failed++;
    }
  }
  if (failed === 0) return { deliveryId, status: 'SENT', messageId: lastMessageId, sent, failed };
  if (sent === 0) return { deliveryId, status: 'FAILED', error: lastError, sent, failed };
  return { deliveryId, status: 'PARTIAL', error: lastError, messageId: lastMessageId, sent, failed };
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
  await updateRow(TABS.users, user.rowNumber, { ...user.row, telegram_id: telegramChatId }).catch(() => null);
  return entry.userId;
}

/** Look up the telegram chat id bound to a user id. */
export async function getTelegramIdForUser(userId: string): Promise<string> {
  const u = await findRow(TABS.users, 'user_id', userId).catch(() => null);
  return u?.row.telegram_id?.trim() ?? '';
}

/** Compose daily brief text from a summary row + alert rows. Pure; per brief §23.1. */
export function composeDailyBrief(
  brandName: string,
  summary: Record<string, string>,
  alerts: Record<string, string>[]
): string {
  const date = summary.date || formatDateWib(new Date());
  const highCritical = alerts.filter((a) => (a.severity === 'HIGH' || a.severity === 'CRITICAL') && a.status !== 'CLOSED' && a.status !== 'RESOLVED');

  const lines: string[] = [];
  lines.push(`<b>YKP WAREHOUSE DAILY BRIEF</b>`);
  lines.push(`${brandName} 📅 ${date}`);
  lines.push('');
  lines.push(`Total Inventory Value: ${formatRp(summary.total_inventory_value)}`);
  lines.push(`Critical Low Stock: ${summary.critical_low_stock_count} item`);
  lines.push(`Stockout Risk: ${summary.stockout_risk_count} item`);
  lines.push(`Recommended Purchase: ${formatRp(summary.estimated_purchase_value)}`);
  lines.push(`Waste Value: ${formatRp(summary.waste_value)}`);
  lines.push(`Unexplained Variance: ${formatRp(summary.unexplained_variance_value)}`);
  lines.push(`Near Expiry: ${summary.near_expiry_item_count} item`);
  lines.push(`Open Actions: ${summary.open_action_count}`);
  if (summary.major_warehouse_issue) {
    lines.push('');
    lines.push(`<b>Major Issue:</b>`);
    lines.push(summary.major_warehouse_issue);
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
      lines.push(`⚠️ ${a.title} (${a.severity})`);
    }
  }

  return lines.join('\n');
}

/** Build daily brief from summary + alerts. Per brief §23.1. */
export async function buildDailyBrief(brandName: string, summary: Record<string, string>): Promise<string> {
  const alerts = await readTab<Record<string, string>>(TABS.alertLog);
  return composeDailyBrief(brandName, summary, alerts);
}

export function formatRp(n: string): string {
  const v = Number(n || 0);
  if (!v) return 'Rp 0';
  return `Rp ${new Intl.NumberFormat('id-ID').format(v)}`;
}

/**
 * After an alert_log row is appended with telegram_status=QUEUED, send HIGH/CRITICAL
 * alerts to Telegram and update the same row to SENT/FAILED.
 * Best-effort: never throws to the caller.
 */
export async function dispatchAlertTelegram(opts: {
  alertId: string;
  severity: string;
  alertType: string;
  title: string;
  message: string;
  actionRequired?: string;
  /** 1-based sheet row of the alert_log entry (from appendRows). */
  startRow: number | null | undefined;
  /** Full alert row so updateRow can rewrite all columns. */
  alertRow: Record<string, string>;
}): Promise<'SENT' | 'FAILED' | 'SKIPPED'> {
  const sev = (opts.severity || '').toUpperCase();
  if (sev !== 'HIGH' && sev !== 'CRITICAL') return 'SKIPPED';
  if (!opts.startRow || opts.startRow < 2) return 'SKIPPED';

  try {
    const result = await sendTelegram({
      sourceModule: 'warehouse_alert',
      sourceReferenceId: opts.alertId,
      messageType: opts.alertType || 'ALERT',
      recipient: process.env.TELEGRAM_CHAT_ID || '',
      text: [
        `<b>[${sev}] ${escapeHtml(opts.title)}</b>`,
        escapeHtml(opts.message),
        opts.actionRequired ? `Action: ${escapeHtml(opts.actionRequired)}` : '',
        `Alert: ${opts.alertId}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
    const status = result.status === 'SENT' ? 'SENT' : 'FAILED';
    await updateRow(TABS.alertLog, opts.startRow, {
      ...opts.alertRow,
      telegram_status: status,
    }).catch(() => null);
    return status;
  } catch {
    await updateRow(TABS.alertLog, opts.startRow, {
      ...opts.alertRow,
      telegram_status: 'FAILED',
    }).catch(() => null);
    return 'FAILED';
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --------------------------------------------------------------------------
// Fraud controls (P0/P2) — appended 2026-07-18. Alert-push compat helpers
// for the cron routes + the fraud-watch block in the daily brief.
// --------------------------------------------------------------------------

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
  lines.push(`<b>[${a.severity}] ${escapeHtml(a.title)}</b>`);
  const meta = [a.outletName, a.date].filter((v) => Boolean(v)).join(' — ');
  if (meta) lines.push(escapeHtml(meta));
  if (a.message && a.message !== a.title) lines.push(escapeHtml(a.message));
  lines.push(`<i>${escapeHtml(sourceLabel)}</i>`);
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

export interface FraudWatchData {
  wasteToday: { count: number; value: number };
  adjustmentsToday: { pending: number; approved: number };
  receivingDiscrepanciesToday: number;
  staleApprovals: number; // PENDING > 24h — rubber-stamp / ignored-queue indicator
}

/**
 * Fraud-watch block appended to the daily brief (anti-fraud blueprint —Layer 3).
 * Deterrence by visibility: the owner sees a named list of the day's
 * manipulation-prone events every morning. Pure function.
 */
export function composeFraudWatchBlock(d: FraudWatchData, date: string): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('<b>FRAUD WATCH:</b>');
  lines.push(`🗑️ Waste hari ini: ${d.wasteToday.count} kasus (${formatRp(String(d.wasteToday.value))})`);
  lines.push(`🔧 Stock adjustment: ${d.adjustmentsToday.pending} pending / ${d.adjustmentsToday.approved} approved`);
  lines.push(`📥 Receiving discrepancy: ${d.receivingDiscrepanciesToday}`);
  if (d.staleApprovals > 0) {
    lines.push(`⏰ Approval menggantung &gt;24 jam: ${d.staleApprovals}`);
  }
  lines.push(`<i>Semua event tercatat di audit log (hash-chained). Laporkan kejanggalan ke owner.</i>`);
  return lines.join('\n');
}

/** Collect today's fraud-watch inputs from the sheets. Never throws. */
export async function collectFraudWatchData(today: string): Promise<FraudWatchData> {
  const empty: FraudWatchData = {
    wasteToday: { count: 0, value: 0 },
    adjustmentsToday: { pending: 0, approved: 0 },
    receivingDiscrepanciesToday: 0,
    staleApprovals: 0
  };
  try {
    const [waste, adjustments, receivings] = await Promise.all([
      readTab<Record<string, string>>(TABS.waste).catch(() => []),
      readTab<Record<string, string>>(TABS.adjustment).catch(() => []),
      readTab<Record<string, string>>(TABS.receiving).catch(() => [])
    ]);

    const wasteTodayRows = waste.filter((w) => (w.date ?? '') === today);
    const wasteValue = wasteTodayRows.reduce((s, w) => s + Number(w.estimated_total_value || 0), 0);

    const adjToday = adjustments.filter((a) => (a.date ?? '') === today);
    const staleApprovals = adjustments.filter(
      (a) => a.approval_status === 'PENDING' && (a.date ?? '') < today
    ).length;

    const recvDiscrepToday = receivings.filter(
      (r) => (r.date ?? '') === today && r.receiving_status === 'DISCREPANCY'
    ).length;

    return {
      wasteToday: { count: wasteTodayRows.length, value: wasteValue },
      adjustmentsToday: {
        pending: adjToday.filter((a) => a.approval_status === 'PENDING').length,
        approved: adjToday.filter((a) => a.approval_status === 'APPROVED').length
      },
      receivingDiscrepanciesToday: recvDiscrepToday,
      staleApprovals
    };
  } catch (e) {
    console.error('[fraud-watch] collect failed:', e);
    return empty;
  }
}