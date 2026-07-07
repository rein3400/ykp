/**
 * Finance-domain audit wrapper. Routes use this to record every state
 * transition (insert / update / approval) into the finance audit_log
 * table. The shape mirrors @ykp/engine logAudit but targets the finance
 * DB so cross-DB writes are not required.
 */
import type { FinanceDb } from "./db.js";
import { financeAuditLog } from "@ykp/schema";

export interface AuditRecord {
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

export async function logFinanceAudit(db: FinanceDb, entry: AuditRecord): Promise<void> {
  await db.insert(financeAuditLog).values({
    actor: entry.actor,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    before: (entry.before ?? null) as never,
    after: (entry.after ?? null) as never,
    reason: entry.reason ?? null,
  });
}