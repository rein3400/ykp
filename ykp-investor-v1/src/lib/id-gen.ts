/**
 * Deterministic ID generators for Investor V1 summary/alert rows so
 * regenerate is idempotent (upsert, never duplicate) — same convention as
 * finance id-gen.ts.
 */

/** investor_daily_summary ID: SUM-YYYYMMDD (one row per date, group level). */
export function invSummaryId(dateStr: string): string {
  return `SUM-${dateStr.replace(/-/g, '')}`;
}

/** Date-scoped alert ID: ALR-YYYYMMDD-<RULE> (one per date+rule). */
export function invDailyAlertId(dateStr: string, alertType: string): string {
  return `ALR-${dateStr.replace(/-/g, '')}-${alertType}`;
}

/**
 * Entity-scoped alert ID: ALR-<RULE>-<refId> (date-independent → the alert
 * is created once per entity, re-runs on later days never duplicate it).
 */
export function invEntityAlertId(alertType: string, refId: string): string {
  return `ALR-${alertType}-${refId}`;
}
