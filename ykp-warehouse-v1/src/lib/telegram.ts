/**
 * Telegram Reporting per brief §23.
 * Sends only HIGH/CRITICAL alerts + daily brief. Never raw stock changes.
 * Logs every delivery to telegram_delivery_log.
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * If not configured, messages are queued with status FAILED (no crash).
 */
import { appendRows, readTab, updateRow, TABS } from '@/db/sheets';
import { nowTimestampWib, formatDateWib } from './format';
import { nextSequentialIdSync } from './repo';

export interface TelegramMessage {
  sourceModule: string;
  sourceReferenceId: string;
  messageType: string;
  recipient: string;
  text: string;
}

export async function sendTelegram(
  msg: TelegramMessage,
): Promise<{ deliveryId: string; status: string; error?: string; messageId?: string }> {
  const deliveryId = nextSequentialIdSync('TDL');
  const now = nowTimestampWib();
  // Strip BOM / whitespace — Vercel env set via Windows PowerShell pipe can inject U+FEFF.
  const clean = (v: string | undefined) => (v ?? '').replace(/^﻿/, '').trim();
  const token = clean(process.env.TELEGRAM_BOT_TOKEN);
  const chatId = clean(msg.recipient) || clean(process.env.TELEGRAM_CHAT_ID);

  if (!token || !chatId) {
    const error = `TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured (token=${token ? 'set' : 'unset'}, chat=${chatId ? 'set' : 'unset'})`;
    await appendRows(TABS.telegramDeliveryLog, [{
      delivery_id: deliveryId,
      source_module: msg.sourceModule,
      source_reference_id: msg.sourceReferenceId,
      message_type: msg.messageType,
      recipient: chatId ?? '',
      message_id: '',
      status: 'FAILED',
      retry_count: '0',
      sent_at: '',
      error_message: error,
      created_at: now
    }]).catch(() => null);
    return { deliveryId, status: 'FAILED', error };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg.text, parse_mode: 'HTML' })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description || 'Telegram API error');

    const messageId = String(data.result?.message_id ?? '');
    await appendRows(TABS.telegramDeliveryLog, [{
      delivery_id: deliveryId,
      source_module: msg.sourceModule,
      source_reference_id: msg.sourceReferenceId,
      message_type: msg.messageType,
      recipient: chatId,
      message_id: messageId,
      status: 'SENT',
      retry_count: '0',
      sent_at: now,
      error_message: '',
      created_at: now
    }]).catch(() => null);
    return { deliveryId, status: 'SENT', messageId };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    await appendRows(TABS.telegramDeliveryLog, [{
      delivery_id: deliveryId,
      source_module: msg.sourceModule,
      source_reference_id: msg.sourceReferenceId,
      message_type: msg.messageType,
      recipient: chatId,
      message_id: '',
      status: 'FAILED',
      retry_count: '0',
      sent_at: '',
      error_message: error,
      created_at: now
    }]).catch(() => null);
    return { deliveryId, status: 'FAILED', error };
  }
}

/** Build daily brief from summary + alerts. Per brief §23.1. */
export async function buildDailyBrief(brandName: string, summary: Record<string, string>): Promise<string> {
  const date = summary.date || formatDateWib(new Date());
  const alerts = await readTab<Record<string, string>>(TABS.alertLog);
  const highCritical = alerts.filter((a) => (a.severity === 'HIGH' || a.severity === 'CRITICAL') && a.status !== 'CLOSED' && a.status !== 'RESOLVED');

  const lines: string[] = [];
  lines.push(`<b>YKP WAREHOUSE DAILY BRIEF</b>`);
  lines.push(`${brandName} — ${date}`);
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
      lines.push(`• ${a.title} (${a.severity})`);
    }
  }

  return lines.join('\n');
}

function formatRp(n: string): string {
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