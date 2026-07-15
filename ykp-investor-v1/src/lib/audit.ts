import { randomBytes } from 'crypto';
import { appendRows, TABS } from '@/db/sheets';
import { nowTimestampWib } from './format';
export interface AuditEntry {
  actorUserId: string; actorRole: string; action: string; entity: string;
  entityId: string; beforeValue?: string; afterValue?: string; reason?: string; ipAddress?: string;
}
export function auditId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(5).toString('hex').toUpperCase();
  return `AUD-${ts}-${rand}`;
}
export async function logAudit(entry: AuditEntry): Promise<void> {
  const row: Record<string, string> = {
    audit_id: auditId(), timestamp: nowTimestampWib(),
    actor_user_id: entry.actorUserId, actor_role: entry.actorRole,
    action: entry.action, entity: entry.entity, entity_id: entry.entityId,
    before_value: entry.beforeValue ?? '', after_value: entry.afterValue ?? '',
    reason: entry.reason ?? '', ip_address: entry.ipAddress ?? ''
  };
  try { await appendRows(TABS.auditLog, [row]); } catch (e) { console.error('[audit] failed:', e); }
}