/**
 * Pure alert rules engine ΓÇö brief ┬º11 (V1 scope).
 *
 * Evaluated rules:
 * - opening completion < 95%            ΓåÆ MEDIUM (< 90% escalates to HIGH)
 * - critical opening failed > 0         ΓåÆ HIGH
 * - incident HIGH (open) > 0            ΓåÆ HIGH
 * - incident CRITICAL (open) > 0        ΓåÆ CRITICAL
 * - incident past deadline (OVERDUE)    ΓåÆ HIGH
 * - waste value > daily limit           ΓåÆ HIGH
 * - same ingredient 3x / 7 days         ΓåÆ MEDIUM (REVIEW)
 * - cash difference > tolerance (50k)   ΓåÆ HIGH
 * - closing not approved by deadline    ΓåÆ MEDIUM
 * - action overdue                      ΓåÆ HIGH
 *
 * KDS / serving-time / QC rules are deferred to V1.5.
 * Deterministic alert IDs: ALR-{outletId}-{date}-{TYPE} (safe to upsert).
 */
import { completionAlertSeverity } from './checklist';
import { isCashAlert } from './cash';

export interface OpsThresholds {
  checklistMinPct: number;       // default 95
  checklistWarningPct: number;   // default 90
  cashTolerance: number;         // default 50000
  wasteDailyLimit: number;       // default 500000
  wasteRepeatCount7d: number;    // default 3
  closingDeadlinePassed: boolean;
}

export const DEFAULT_THRESHOLDS: Omit<OpsThresholds, 'closingDeadlinePassed'> = {
  checklistMinPct: 95,
  checklistWarningPct: 90,
  cashTolerance: 50000,
  wasteDailyLimit: 500000,
  wasteRepeatCount7d: 3
};

export interface IncidentState {
  severity?: string;
  status?: string;      // OPEN | IN_PROGRESS | RESOLVED | CLOSED
  due_date?: string;
  incident_type?: string;
}

export interface ActionState {
  status?: string;      // OPEN | IN_PROGRESS | DONE | CANCELLED
  due_date?: string;
}

export interface OpsContext {
  date: string;
  outletId: string;
  opening: { hasChecklist: boolean; completionPct: number; criticalFailed: number };
  incidents: IncidentState[];
  wasteValue: number;
  repeatedWasteIngredients: string[];
  cashDifference: number | null; // null when no reconciliation exists
  closingApproved: boolean;
  actions: ActionState[];
  thresholds: OpsThresholds;
}

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AlertSpec {
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  referenceType: string;
  referenceId: string;
  actionRequired: string;
}

const OPEN_INCIDENT = new Set(['OPEN', 'IN_PROGRESS']);
const OPEN_ACTION = new Set(['OPEN', 'IN_PROGRESS']);

export function isIncidentOpen(status: string | undefined): boolean {
  return OPEN_INCIDENT.has(status ?? '');
}

/** OVERDUE detection: open incident whose deadline has passed. */
export function isIncidentOverdue(i: IncidentState, date: string): boolean {
  const due = i.due_date ?? '';
  return isIncidentOpen(i.status) && due !== '' && due < date;
}

/** Deterministic alert ID ΓÇö stable across regenerations (upsert-safe). */
export function alertId(outletId: string, date: string, type: string): string {
  return `ALR-${outletId}-${date}-${type}`;
}

/** Deterministic action ID derived from the source alert. */
export function actionId(alertIdValue: string): string {
  return `ACT-${alertIdValue}`;
}

export function evaluateOpsAlerts(ctx: OpsContext): AlertSpec[] {
  const alerts: AlertSpec[] = [];
  const th = ctx.thresholds;

  // 1. Opening completion
  if (ctx.opening.hasChecklist) {
    const sev = completionAlertSeverity(ctx.opening.completionPct, th.checklistMinPct, th.checklistWarningPct);
    if (sev) {
      alerts.push({
        type: 'OPENING_COMPLETION_LOW',
        severity: sev,
        title: `Opening checklist ${ctx.opening.completionPct}% (< ${th.checklistMinPct}%)`,
        message: `Completion opening checklist ${ctx.opening.completionPct}% di bawah minimum ${th.checklistMinPct}%.`,
        referenceType: 'opening_checklist',
        referenceId: `${ctx.outletId}-${ctx.date}`,
        actionRequired: 'Lengkapi opening checklist dan review item yang belum selesai.'
      });
    }
    // 2. Critical opening failed
    if (ctx.opening.criticalFailed > 0) {
      alerts.push({
        type: 'OPENING_CRITICAL_FAILED',
        severity: 'HIGH',
        title: `${ctx.opening.criticalFailed} critical opening item FAILED`,
        message: `${ctx.opening.criticalFailed} item critical opening checklist gagal. Outlet tidak boleh READY sebelum critical item selesai.`,
        referenceType: 'opening_checklist',
        referenceId: `${ctx.outletId}-${ctx.date}`,
        actionRequired: 'Perbaiki item critical yang FAILED dan minta review supervisor.'
      });
    }
  }

  // 3+4. Incident HIGH / CRITICAL escalation (open incidents only)
  const open = ctx.incidents.filter((i) => isIncidentOpen(i.status));
  const highCount = open.filter((i) => i.severity === 'HIGH').length;
  const criticalCount = open.filter((i) => i.severity === 'CRITICAL').length;
  if (criticalCount > 0) {
    alerts.push({
      type: 'INCIDENT_CRITICAL',
      severity: 'CRITICAL',
      title: `${criticalCount} incident CRITICAL terbuka`,
      message: `${criticalCount} incident berseverity CRITICAL belum selesai. Eskalasi ke owner/manager.`,
      referenceType: 'incident',
      referenceId: `${ctx.outletId}-${ctx.date}`,
      actionRequired: 'Tangani incident CRITICAL segera, assign PIC dan deadline.'
    });
  }
  if (highCount > 0) {
    alerts.push({
      type: 'INCIDENT_HIGH',
      severity: 'HIGH',
      title: `${highCount} incident HIGH terbuka`,
      message: `${highCount} incident berseverity HIGH belum selesai.`,
      referenceType: 'incident',
      referenceId: `${ctx.outletId}-${ctx.date}`,
      actionRequired: 'Assign PIC dan selesaikan incident HIGH sebelum closing.'
    });
  }

  // 5. Incident overdue
  const overdueIncidents = open.filter((i) => isIncidentOverdue(i, ctx.date));
  if (overdueIncidents.length > 0) {
    alerts.push({
      type: 'INCIDENT_OVERDUE',
      severity: 'HIGH',
      title: `${overdueIncidents.length} incident melewati deadline`,
      message: `${overdueIncidents.length} incident belum selesai melewati deadline (escalation).`,
      referenceType: 'incident',
      referenceId: `${ctx.outletId}-${ctx.date}`,
      actionRequired: 'Eskalasi incident overdue ke outlet manager.'
    });
  }

  // 6. Waste over daily limit
  if (ctx.wasteValue > th.wasteDailyLimit) {
    alerts.push({
      type: 'WASTE_OVER_LIMIT',
      severity: 'HIGH',
      title: `Waste Rp ${ctx.wasteValue.toLocaleString('id-ID')} > limit`,
      message: `Nilai waste hari ini Rp ${ctx.wasteValue.toLocaleString('id-ID')} melebihi batas harian Rp ${th.wasteDailyLimit.toLocaleString('id-ID')}.`,
      referenceType: 'waste',
      referenceId: `${ctx.outletId}-${ctx.date}`,
      actionRequired: 'Review penyebab waste dan buat preventive action.'
    });
  }

  // 7. Same ingredient wasted >= N times in 7 days (REVIEW)
  if (ctx.repeatedWasteIngredients.length > 0) {
    alerts.push({
      type: 'WASTE_REPEATED_ITEM',
      severity: 'MEDIUM',
      title: `Waste berulang: ${ctx.repeatedWasteIngredients.join(', ')}`,
      message: `Bahan ${ctx.repeatedWasteIngredients.join(', ')} waste >= ${th.wasteRepeatCount7d}x dalam 7 hari. Perlu root cause review.`,
      referenceType: 'waste',
      referenceId: `${ctx.outletId}-${ctx.date}`,
      actionRequired: 'Lakukan root cause review untuk bahan yang berulang.'
    });
  }

  // 8. Cash difference over tolerance
  if (ctx.cashDifference !== null && isCashAlert(ctx.cashDifference, th.cashTolerance)) {
    const diff = Math.abs(ctx.cashDifference);
    alerts.push({
      type: 'CASH_DIFFERENCE_OVER_TOLERANCE',
      severity: 'HIGH',
      title: `Selisih kas Rp ${diff.toLocaleString('id-ID')} > toleransi`,
      message: `Cash difference Rp ${ctx.cashDifference.toLocaleString('id-ID')} melebihi toleransi Rp ${th.cashTolerance.toLocaleString('id-ID')}. Kronologi wajib diisi.`,
      referenceType: 'cash_reconciliation',
      referenceId: `${ctx.outletId}-${ctx.date}`,
      actionRequired: 'Audit kasir shift terkait dan verifikasi kronologi selisih.'
    });
  }

  // 9. Closing not completed by deadline
  if (ctx.thresholds.closingDeadlinePassed && !ctx.closingApproved) {
    alerts.push({
      type: 'CLOSING_INCOMPLETE',
      severity: 'MEDIUM',
      title: 'Closing belum selesai melewati deadline',
      message: 'Closing / rekonsiliasi kas belum di-approve melewati jam batas closing.',
      referenceType: 'closing',
      referenceId: `${ctx.outletId}-${ctx.date}`,
      actionRequired: 'Selesaikan closing checklist dan approval rekonsiliasi kas.'
    });
  }

  // 10. Action overdue
  const overdueActions = ctx.actions.filter((a) => OPEN_ACTION.has(a.status ?? '') && (a.due_date ?? '') !== '' && (a.due_date ?? '') < ctx.date);
  if (overdueActions.length > 0) {
    alerts.push({
      type: 'ACTION_OVERDUE',
      severity: 'HIGH',
      title: `${overdueActions.length} action item overdue`,
      message: `${overdueActions.length} action item melewati due date dan belum selesai.`,
      referenceType: 'action',
      referenceId: `${ctx.outletId}-${ctx.date}`,
      actionRequired: 'Follow up PIC action item yang overdue.'
    });
  }

  return alerts;
}

/** Whether an alert severity must auto-create an action tracker row. */
export function requiresAction(severity: AlertSeverity): boolean {
  return severity === 'HIGH' || severity === 'CRITICAL';
}
