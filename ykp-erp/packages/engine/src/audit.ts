// ============================================================
// @ykp/engine — Audit log
// ------------------------------------------------------------
// Single helper to write an audit row. Used by every state
// transition in finance/HR approval flows and Hermez alerts.
//
// Schema (declared in @ykp/schema per domain):
//   audit_log (in master DB, hr DB, finance DB, hermez DB)
//     id BIGSERIAL PRIMARY KEY,
//     actor TEXT NOT NULL,
//     action TEXT NOT NULL,
//     entity TEXT NOT NULL,
//     entity_id TEXT NOT NULL,
//     before JSONB,
//     after JSONB,
//     reason TEXT,
//     created_at TIMESTAMP NOT NULL DEFAULT now()
//
// Each domain DB owns its own audit_log table (mirrored shape)
// so cross-DB writes are not required.
// ============================================================

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { masterAuditLog, hrAuditLog, financeAuditLog, hermezAuditLog } from "@ykp/schema";

export type AuditDomain = "master" | "hr" | "finance" | "hermez";

export type AuditEntry = {
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
};

/** Format Date as WIB ISO-like string with explicit +07:00 offset. */
export function nowWibIso(d: Date = new Date()): string {
  // Project convention: store naive WIB; format with offset only for Telegram output.
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}+07:00`;
}

/** Returns today's date in Asia/Jakarta as YYYY-MM-DD. */
export function todayWib(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Append an audit row. Pass the appropriate db handle AND domain
 * indicator so the correct audit_log table is written:
 *   - "master"   -> master_audit_log
 *   - "hr"       -> hr_audit_log
 *   - "finance"  -> finance_audit_log
 *   - "hermez"   -> hermez_audit_log
 *
 * Every audit_log table shares the same column shape so a single
 * values object can be re-used.
 */
export async function logAudit(
  db: PostgresJsDatabase<Record<string, unknown>>,
  entry: AuditEntry,
  domain: AuditDomain = "master",
): Promise<void> {
  const target =
    domain === "hr"
      ? hrAuditLog
      : domain === "finance"
        ? financeAuditLog
        : domain === "hermez"
          ? hermezAuditLog
          : masterAuditLog;
  await db.insert(target).values({
    actor: entry.actor,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason ?? null,
  });
}
