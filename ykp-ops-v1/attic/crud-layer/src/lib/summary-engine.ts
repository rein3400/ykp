/**
 * Pure daily summary engine ΓÇö brief ┬º7 ops_daily_summary (28 KPI columns
 * + summary_id + created_at). KDS/QC columns are zeroed (V1.5 scope).
 *
 * buildDailySummary is deterministic and side-effect free; the IO wrapper
 * (alert-engine.ts / regenerate route) gathers the inputs.
 */
import type { AlertSpec } from './alert-rules';
import type { OutletReadyStatus } from './checklist';

export interface SummaryInput {
  date: string;
  brandId: string;
  brandName: string;
  outletId: string;
  outletName: string;
  opening: {
    hasChecklist: boolean;
    status: OutletReadyStatus;
    completionPct: number;
    criticalFailed: number;
  };
  briefing: { scheduledStaff: number; actualStaff: number; staffingWarning: string } | null;
  incidents: { severity: string; incident_type: string }[];
  waste: { count: number; totalQty: number; totalValue: number };
  closing: { approved: boolean; exists: boolean; cashDifference: number | null };
  openActionCount: number;
  alerts: AlertSpec[];
}

export interface DailySummaryRow {
  summary_id: string;
  date: string;
  brand_id: string;
  brand_name: string;
  outlet_id: string;
  outlet_name: string;
  opening_status: string;
  opening_completion_percentage: string;
  critical_opening_issue: string;
  scheduled_staff: string;
  actual_staff: string;
  shift_shortage: string;
  total_orders: string;
  avg_serving_time: string;
  orders_over_sla: string;
  critical_delay_count: string;
  avg_qc_score: string;
  qc_fail_count: string;
  incident_count: string;
  high_severity_incident: string;
  complaint_count: string;
  waste_qty: string;
  waste_value: string;
  stock_issue_count: string;
  closing_status: string;
  cash_difference: string;
  open_action_count: string;
  major_ops_issue: string;
  recommended_action: string;
  created_at: string;
}

export function summaryId(outletId: string, date: string): string {
  return `SUM-${outletId}-${date}`;
}

const ACTION_BY_TYPE: Record<string, string> = {
  OPENING_COMPLETION_LOW: 'Lengkapi opening checklist',
  OPENING_CRITICAL_FAILED: 'Perbaiki critical opening item yang FAILED',
  INCIDENT_CRITICAL: 'Tangani incident CRITICAL segera',
  INCIDENT_HIGH: 'Selesaikan incident HIGH',
  INCIDENT_OVERDUE: 'Eskalasi incident overdue',
  WASTE_OVER_LIMIT: 'Audit penyebab waste',
  WASTE_REPEATED_ITEM: 'Root cause review waste berulang',
  CASH_DIFFERENCE_OVER_TOLERANCE: 'Audit kasir dan verifikasi kronologi selisih',
  CLOSING_INCOMPLETE: 'Selesaikan closing dan approval kas',
  ACTION_OVERDUE: 'Follow up action item overdue'
};

export function buildDailySummary(input: SummaryInput, createdAt: string): DailySummaryRow {
  const highSev = input.incidents.filter((i) => i.severity === 'HIGH' || i.severity === 'CRITICAL').length;
  const complaints = input.incidents.filter((i) => i.incident_type === 'CUSTOMER_COMPLAINT').length;
  const staffingWarning = input.briefing?.staffingWarning ?? '';

  const top = input.alerts.filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH');
  const majorIssue = top.length > 0 ? top.map((a) => a.title).join('; ') : '';
  const recommended = top.length > 0
    ? [...new Set(top.map((a) => ACTION_BY_TYPE[a.type] ?? a.actionRequired))].join('; ')
    : '';

  return {
    summary_id: summaryId(input.outletId, input.date),
    date: input.date,
    brand_id: input.brandId,
    brand_name: input.brandName,
    outlet_id: input.outletId,
    outlet_name: input.outletName,
    opening_status: input.opening.hasChecklist ? input.opening.status : 'NOT_STARTED',
    opening_completion_percentage: String(input.opening.completionPct),
    critical_opening_issue: String(input.opening.criticalFailed),
    scheduled_staff: String(input.briefing?.scheduledStaff ?? 0),
    actual_staff: String(input.briefing?.actualStaff ?? 0),
    shift_shortage: staffingWarning ? '1' : '0',
    // ΓöÇΓöÇ V1.5 deferred (KDS / QC) ΓöÇΓöÇ
    total_orders: '0',
    avg_serving_time: '0',
    orders_over_sla: '0',
    critical_delay_count: '0',
    avg_qc_score: '0',
    qc_fail_count: '0',
    // ΓöÇΓöÇ V1 ΓöÇΓöÇ
    incident_count: String(input.incidents.length),
    high_severity_incident: String(highSev),
    complaint_count: String(complaints),
    waste_qty: String(input.waste.totalQty),
    waste_value: String(input.waste.totalValue),
    stock_issue_count: '0',
    closing_status: input.closing.approved ? 'APPROVED' : input.closing.exists ? 'PENDING' : 'MISSING',
    cash_difference: String(input.closing.cashDifference ?? 0),
    open_action_count: String(input.openActionCount),
    major_ops_issue: majorIssue,
    recommended_action: recommended,
    created_at: createdAt
  };
}
