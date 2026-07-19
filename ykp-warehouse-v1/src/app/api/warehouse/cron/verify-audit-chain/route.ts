/**
 * POST /api/warehouse/cron/verify-audit-chain
 * Protected by CRON_SECRET (x-cron-secret / Authorization: Bearer).
 *
 * Nightly scheduler (recommend: 23:30 WIB, after the daily brief) — runs the
 * tamper-evidence hash-chain verification over system_audit_log.
 *
 * The chain only deters tampering if someone CHECKS it (anti-fraud blueprint
 * §Layer 2 #9). On break: CRITICAL alert + Telegram push + action item.
 * On success: silent (audit row written, ok returned).
 */
import { NextRequest } from 'next/server';
import { ok, unauthorized, handler } from '@/lib/http';
import { isCronAuthorized } from '@/lib/cron';
import { verifyAuditChain, logAudit } from '@/lib/audit';
import { appendRows, TABS } from '@/db/sheets';
import { nextSequentialIdSync } from '@/lib/repo';
import { nowTimestampWib, formatDateWib } from '@/lib/format';
import { pushAlertNotification } from '@/lib/telegram';

export const POST = handler(async (req: NextRequest) => {
  if (!isCronAuthorized(req)) return unauthorized('Invalid or missing CRON_SECRET');

  const result = await verifyAuditChain();
  const now = nowTimestampWib();
  const today = formatDateWib(new Date());

  await logAudit({
    module: 'warehouse',
    action: 'verify',
    recordType: 'audit_chain',
    recordId: today,
    afterValue: JSON.stringify({
      ok: result.ok,
      checked: result.checked,
      skippedLegacy: result.skippedLegacy,
      brokenAt: result.brokenAt ?? null
    }),
    userId: 'cron'
  }).catch(() => null);

  if (!result.ok && result.brokenAt) {
    const alertId = nextSequentialIdSync('ALR');
    const title = 'AUDIT LOG TAMPERED — chain broken';
    const message =
      `Hash chain putus di baris #${result.brokenAt.index} (audit_id ${result.brokenAt.auditId}). ` +
      `Kemungkinan ada perubahan/penghapusan manual di system_audit_log. ` +
      `Checked ${result.checked} chained rows. Investigasi SEGERA.`;
    await appendRows(TABS.alertLog, [{
      alert_id: alertId,
      alert_datetime: now,
      alert_type: 'UNAPPROVED_ADJUSTMENT',
      severity: 'CRITICAL',
      brand_id: '',
      outlet_id: '',
      location_id: '',
      item_id: '',
      reference_type: 'audit_chain',
      reference_id: result.brokenAt.auditId,
      title,
      message,
      status: 'OPEN',
      assigned_to: 'owner',
      due_date: today,
      action_required: 'Investigate audit log tampering immediately',
      telegram_status: 'QUEUED',
      created_at: now,
      resolved_at: '',
      resolved_by: ''
    }]).catch(() => null);

    await pushAlertNotification('warehouse', {
      alertId,
      alertType: 'AUDIT_CHAIN_BROKEN',
      severity: 'CRITICAL',
      title,
      message,
      date: today
    });

    // Auto-action for the owner (HIGH/CRITICAL → action tracker).
    const actionId = nextSequentialIdSync('ACT');
    await appendRows(TABS.actionTracker, [{
      action_id: actionId,
      source_alert_id: alertId,
      title: `Investigasi audit chain break di ${result.brokenAt.auditId}`,
      description: message,
      brand_id: '',
      outlet_id: '',
      location_id: '',
      item_id: '',
      priority: 'HIGH',
      assigned_to: 'owner',
      assigned_role: 'owner',
      due_date: today,
      status: 'OPEN',
      action_taken: '',
      attachment_url: '',
      approved_by: '',
      created_at: now,
      updated_at: now,
      completed_at: ''
    }]).catch(() => null);
  }

  return ok({
    ok: result.ok,
    checked: result.checked,
    skippedLegacy: result.skippedLegacy,
    brokenAt: result.brokenAt ?? null
  });
});
