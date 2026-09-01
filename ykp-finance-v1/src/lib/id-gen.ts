/**
 * ID generators for YKP Finance V1.
 * - User-facing transactions: race-free `PREFIX-{ts36}{rand6}` (warehouse convention).
 * - Summary / alert / action rows: deterministic per (date, rule, outlet) so
 *   regenerate is idempotent (upsert, never duplicate).
 */
import { randomBytes } from 'crypto';

/** Race-free unique ID: PREFIX-{ts36}{rand6}. */
export function nextSequentialIdSync(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}${rand}`;
}

/** fin_daily_summary ID: FIN-YYYYMMDD-OL-001 (one row per date+outlet). */
export function finSummaryId(dateStr: string, outletId: string): string {
  return `FIN-${dateStr.replace(/-/g, '')}-${outletId}`;
}

/** finance_alert_log ID: ALR-YYYYMMDD-<RULE>-OL-001 (deterministic → dedupe on regenerate). */
export function finAlertId(dateStr: string, alertType: string, outletId: string): string {
  return `ALR-${dateStr.replace(/-/g, '')}-${alertType}-${outletId}`;
}

/** finance_action_tracker ID: ACT-YYYYMMDD-<RULE>-OL-001 (mirrors its source alert). */
export function finActionId(dateStr: string, alertType: string, outletId: string): string {
  return `ACT-${dateStr.replace(/-/g, '')}-${alertType}-${outletId}`;
}

/** Audit row ID. */
export function auditId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(5).toString('hex').toUpperCase();
  return `AUD-${ts}-${rand}`;
}
