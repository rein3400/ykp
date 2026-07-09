/**
 * Audit log writer. Every mutation writes one row to audit_log sheet.
 * Brief §10: all approvals + bank/salary changes must be audited.
 *
 * auditId format: `AUD-<ts36>-<randHex>`. ts36 keeps rough time ordering
 * for human scan; randomBytes(5) guarantees uniqueness across processes,
 * concurrent calls, and server restarts (collision probability < 1e-9
 * for pilot scale of 5-10 staff × 30 days ≈ 1k entries).
 */
import { randomBytes } from 'crypto';
import { appendRows, TABS } from '@/db/sheets';
import { nowTimestampWib } from './format';

export interface AuditEntry {
  actorUserId: string;
  actorRole: string;
  action: string; // create | update | delete | approve | reject | generate | mark_paid
  entity: string; // attendance | payroll | employee ...
  entityId: string;
  beforeValue?: string;
  afterValue?: string;
  reason?: string;
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
    timestamp: nowTimestampWib(),
    actor_user_id: entry.actorUserId,
    actor_role: entry.actorRole,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId,
    before_value: entry.beforeValue ?? '',
    after_value: entry.afterValue ?? '',
    reason: entry.reason ?? '',
    ip_address: entry.ipAddress ?? ''
  };
  try {
    await appendRows(TABS.auditLog, [row]);
  } catch (e) {
    // Audit failure must not break the main op, but must be visible.
    console.error('[audit] failed to write audit log:', e);
  }
}