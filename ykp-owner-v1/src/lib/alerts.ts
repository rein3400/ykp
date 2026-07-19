/**
 * Alert normalization, merge and severity sort — pure functions, vitest-covered.
 * Sources differ per module:
 *  - warehouse / finance / ops expose public GET /alerts + /actions endpoints
 *    (alert_log / action_tracker rows; envelopes differ slightly per module)
 *  - every module embeds alert-ish fields in its daily summary
 *    (major_*_issue, high_severity_incident, cash_difference, …)
 * Both are normalized into OwnerAlert and merged, CRITICAL → LOW.
 */
import type { ModuleKey, OwnerAction, OwnerAlert, Severity, SummaryRow } from './types';

const RANK: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** Map raw module severities (critical/warning/high/...) onto our 4 levels. */
export function normalizeSeverity(raw: string | undefined | null): Severity {
  const s = (raw ?? '').trim().toUpperCase();
  if (s === 'CRITICAL' || s === 'CRIT') return 'CRITICAL';
  if (s === 'HIGH' || s === 'WARNING' || s === 'WARN') return 'HIGH';
  if (s === 'MEDIUM' || s === 'MED' || s === 'INFO') return 'MEDIUM';
  return 'LOW';
}

export function compareAlerts(a: OwnerAlert, b: OwnerAlert): number {
  const r = RANK[a.severity] - RANK[b.severity];
  if (r !== 0) return r;
  // Newest first inside a severity; unparseable times sink to the bottom.
  return (b.time || '').localeCompare(a.time || '');
}

export function sortAlerts(alerts: OwnerAlert[]): OwnerAlert[] {
  return [...alerts].sort(compareAlerts);
}

export function mergeAlerts(...lists: OwnerAlert[][]): OwnerAlert[] {
  return sortAlerts(lists.flat());
}

export function countBySeverity(alerts: OwnerAlert[], ...severities: Severity[]): number {
  const want = new Set<Severity>(severities);
  return alerts.filter((a) => want.has(a.severity)).length;
}

/** True when an OPEN action's due date is before today (or status OVERDUE). */
export function isOverdue(status: string, dueDate: string, today: string): boolean {
  const s = status.toUpperCase();
  if (s === 'OVERDUE') return true;
  if (s === 'DONE' || s === 'COMPLETED' || s === 'CLOSED' || s === 'RESOLVED') return false;
  return !!dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && dueDate < today;
}

/** OPEN = anything not in a terminal state. */
export function isOpenStatus(status: string): boolean {
  const s = status.toUpperCase();
  return !['DONE', 'COMPLETED', 'CLOSED', 'RESOLVED', 'IGNORED', 'CANCELLED'].includes(s);
}

/**
 * Module alert_log row → OwnerAlert. Handles the per-module envelope variants:
 *  - warehouse/ops: alert_datetime, brand_id/outlet_id only
 *  - finance:       date + created_at, brand/outlet carry display names
 */
export function alertFromModuleRow(
  row: SummaryRow,
  module: ModuleKey,
  deepLink: string
): OwnerAlert {
  const stamp = row.alert_datetime || row.created_at || row.date || '';
  return {
    id: row.alert_id || `${module}-${stamp}-${row.title}`,
    module,
    severity: normalizeSeverity(row.severity),
    brand: row.brand_name || row.brand || row.brand_id || 'ALL',
    outlet: row.outlet_name || row.outlet || row.outlet_id || 'ALL',
    title: row.title || row.alert_type || 'Alert',
    message: row.message || row.action_required || row.title || '',
    time: stamp.replace('T', ' ').slice(0, 16),
    status: row.status || 'OPEN',
    deepLink
  };
}

/** Backward-compatible alias for the original warehouse-only normalizer. */
export function alertFromWarehouseRow(
  row: SummaryRow,
  module: ModuleKey,
  deepLink: string
): OwnerAlert {
  return alertFromModuleRow(row, module, deepLink);
}

/** Module action_tracker row → OwnerAction (warehouse/finance/ops shapes). */
export function actionFromModuleRow(
  row: SummaryRow,
  module: ModuleKey,
  deepLink: string,
  today: string
): OwnerAction {
  const status = (row.status || 'OPEN').toUpperCase();
  return {
    id: row.action_id || `${module}-${row.title}`,
    module,
    title: row.title || 'Action',
    brand: row.brand_name || row.brand || row.brand_id || 'ALL',
    outlet: row.outlet_name || row.outlet || row.outlet_id || 'ALL',
    pic: row.assigned_to || row.assigned_role || '',
    dueDate: row.due_date || '',
    status,
    overdue: isOverdue(row.status ?? '', row.due_date ?? '', today),
    deepLink
  };
}

/**
 * Synthesize alerts from a module's daily-summary alert fields so modules
 * without a public alerts endpoint still surface in the inbox.
 */
export function alertsFromSummary(module: ModuleKey, rows: SummaryRow[], deepLink: string): OwnerAlert[] {
  const out: OwnerAlert[] = [];
  for (const r of rows) {
    const where = { brand: r.brand_name || 'ALL', outlet: r.outlet_name || 'ALL' };
    const push = (kind: string, severity: Severity, message: string) => {
      if (!message) return;
      out.push({
        id: `${module}-sum-${kind}-${r.summary_id ?? `${r.date}-${r.outlet_id}`}`,
        module,
        severity,
        ...where,
        title: kind.replace(/_/g, ' '),
        message,
        time: `${r.date ?? ''} 23:59`,
        status: 'OPEN',
        deepLink
      });
    };
    if (module === 'finance') {
      push('major_finance_issue', 'HIGH', r.major_finance_issue);
      const cd = Number(r.cash_difference ?? 0);
      if (Number.isFinite(cd) && Math.abs(cd) >= 50000) {
        push('cash_difference', 'HIGH', `Selisih kas ${cd < 0 ? '-' : ''}Rp${Math.abs(cd).toLocaleString('id-ID')} di ${r.outlet_name}`);
      }
    }
    if (module === 'hr') {
      push('major_hr_issue', 'HIGH', r.major_hr_issue);
      if (Number(r.shift_shortage ?? 0) > 0) {
        push('shift_shortage', 'MEDIUM', `Kekurangan shift ${r.shift_shortage} orang di ${r.outlet_name}`);
      }
    }
    if (module === 'warehouse') {
      push('major_warehouse_issue', 'HIGH', r.major_warehouse_issue);
      if (Number(r.critical_low_stock_count ?? 0) > 0) {
        push('critical_low_stock', 'CRITICAL', `${r.critical_low_stock_count} item stok kritis di ${r.outlet_name}`);
      }
      if (Number(r.expired_item_count ?? 0) > 0) {
        push('expired_items', 'HIGH', `${r.expired_item_count} item kedaluwarsa di ${r.outlet_name}`);
      }
    }
    if (module === 'ops') {
      push('major_ops_issue', 'HIGH', r.major_ops_issue);
      if (Number(r.high_severity_incident ?? 0) > 0) {
        push('high_severity_incident', 'HIGH', `${r.high_severity_incident} insiden berat di ${r.outlet_name}`);
      }
    }
  }
  return out;
}
