/**
 * Audit log writer. Every mutation writes one row to system_audit_log sheet.
 * Expanded per brief §30: module, record_type, approval_user_id, environment.
 * auditId: `AUD-<ts36>-<randHex>` (race-free across processes/restarts).
 */
import { randomBytes } from 'crypto';
import { appendRows, TABS } from '@/db/sheets';
import { nowTimestampWib } from './format';

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

export function auditId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(5).toString('hex').toUpperCase();
  return `AUD-${ts}-${rand}`;
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
