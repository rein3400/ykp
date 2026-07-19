/**
 * Pure checklist calculation logic ΓÇö brief ┬º6.3.
 *
 * Rules:
 * - completion% = completed items / total items (completed = any status except NOT_STARTED)
 * - completion < 90% = WARNING alert (escalated severity)
 * - critical failed > 0 = HIGH alert + outlet status FAILED
 * - outlet cannot be READY with failed critical items
 *   (READY requires completion >= 95% AND zero failed critical items)
 */
export interface ChecklistItemState {
  status?: string;        // NOT_STARTED | OK | ISSUE | FAILED | WAIVED | REVIEWED
  critical_flag?: string; // YES | NO
}

export type OutletReadyStatus = 'NOT_STARTED' | 'READY' | 'CONDITIONAL' | 'FAILED';

const COMPLETED = new Set(['OK', 'ISSUE', 'FAILED', 'WAIVED', 'REVIEWED']);

export function isCompleted(status: string | undefined): boolean {
  return COMPLETED.has(status ?? '');
}

/** Completion percentage (0-100, 1 decimal). Empty list ΓåÆ 0. */
export function completionPct(items: ChecklistItemState[]): number {
  if (items.length === 0) return 0;
  const done = items.filter((i) => isCompleted(i.status)).length;
  return Math.round((done / items.length) * 1000) / 10;
}

export function criticalFailedCount(items: ChecklistItemState[]): number {
  return items.filter((i) => i.critical_flag === 'YES' && i.status === 'FAILED').length;
}

export function issueCount(items: ChecklistItemState[]): number {
  return items.filter((i) => i.status === 'ISSUE' || i.status === 'FAILED').length;
}

/**
 * Outlet ready status:
 * - FAILED      ΓåÆ any failed critical item (cannot open cleanly)
 * - NOT_STARTED ΓåÆ no item touched yet
 * - READY       ΓåÆ completion >= 95% and no failed critical items
 * - CONDITIONAL ΓåÆ otherwise (partial progress, or done but below 95%)
 */
export function outletReadyStatus(items: ChecklistItemState[], minPct = 95): OutletReadyStatus {
  if (items.length === 0) return 'NOT_STARTED';
  if (criticalFailedCount(items) > 0) return 'FAILED';
  const started = items.some((i) => isCompleted(i.status));
  if (!started) return 'NOT_STARTED';
  if (completionPct(items) >= minPct) return 'READY';
  return 'CONDITIONAL';
}

/** Alert severity for a completion percentage. null = no alert.
 * < 95% ΓåÆ MEDIUM, < 90% ΓåÆ HIGH (escalated WARNING per brief ┬º6.3). */
export function completionAlertSeverity(
  pct: number,
  minPct = 95,
  warningPct = 90
): 'MEDIUM' | 'HIGH' | null {
  if (pct < warningPct) return 'HIGH';
  if (pct < minPct) return 'MEDIUM';
  return null;
}
