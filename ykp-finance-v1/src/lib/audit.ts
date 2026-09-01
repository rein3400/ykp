/**
 * Audit log writer. Every mutation writes one row to audit_log sheet.
 * Revisi #27: before_value / after_value / changed_by / reason / approved_by
 * are mandatory for sensitive fields (supplier payment, petty cash, expense,
 * threshold changes, deletes).
 */
import { appendRows, TABS } from '@/db/sheets';
import { nowTimestampWib } from './format';
import { auditId } from './id-gen';

export interface AuditEntry {
  module: string;
  action: string;
  recordType: string;
  recordId: string;
  beforeValue?: string;
  afterValue?: string;
  reason?: string;
  userId: string;
  approvalUserId?: string;
  environment?: string;
  ipAddress?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const row: Record<string, string> = {
    audit_id: auditId(),
    module: entry.module,
    action: entry.action,
    record_type: entry.recordType,
    record_id: entry.recordId,
    before_value: entry.beforeValue ?? '',
    after_value: entry.afterValue ?? '',
    reason: entry.reason ?? '',
    user_id: entry.userId,
    approval_user_id: entry.approvalUserId ?? '',
    environment: entry.environment ?? process.env.ENVIRONMENT ?? 'TESTING',
    ip_address: entry.ipAddress ?? '',
    created_at: nowTimestampWib()
  };
  try {
    await appendRows(TABS.auditLog, [row]);
  } catch (e) {
    console.error('[audit] failed to write audit log:', e);
  }
}
