/**
 * Alert engine (IO orchestration). Gathers the operational context for one
 * (date, outlet), evaluates the pure rules in alert-rules.ts, upserts
 * ops_alert_log with deterministic IDs, and auto-creates ops_action_tracker
 * rows for HIGH/CRITICAL alerts (PIC, deadline, OPEN).
 */
import { readTab, appendRows, updateRow, findRow, TABS } from '@/db/sheets';
import { nowTimestampWib, todayWib, formatTimeWib } from './format';
import { completionPct, criticalFailedCount, outletReadyStatus } from './checklist';
import { aggregateWaste, repeatedWasteIngredients } from './waste';
import { evaluateOpsAlerts, alertId, actionId, requiresAction, type OpsContext, type AlertSpec } from './alert-rules';
import { getThresholds, closingDeadlinePassed } from './thresholds';
import { buildDailySummary, summaryId } from './summary-engine';
import { logAudit } from './audit';
import { shiftDate } from './waste';
import { pushAlertNotification, shouldNotifyNewAlert } from './telegram';

export interface EngineResult {
  date: string;
  outletId: string;
  alertsEvaluated: number;
  alertsCreated: number;
  alertsUpdated: number;
  actionsCreated: number;
  summaryId: string;
}

/** Gather all inputs for (date, outletId) from the tabs. */
export async function gatherContext(date: string, outletId: string): Promise<OpsContext> {
  const [openingHeaders, openingItems, incidents, waste, recon, actions] = await Promise.all([
    readTab<Record<string, string>>(TABS.openingChecklist),
    readTab<Record<string, string>>(TABS.openingChecklistItem),
    readTab<Record<string, string>>(TABS.incident),
    readTab<Record<string, string>>(TABS.wasteLog),
    readTab<Record<string, string>>(TABS.cashReconciliation),
    readTab<Record<string, string>>(TABS.actionTracker)
  ]);

  const th = await getThresholds(outletId);
  const header = openingHeaders.find((h) => h.date === date && h.outlet_id === outletId);
  const items = header ? openingItems.filter((i) => i.checklist_id === header.checklist_id) : [];
  const dayIncidents = incidents.filter((i) => i.date === date && i.outlet_id === outletId);
  const wasteAgg = aggregateWaste(waste, date, outletId);
  const repeated = repeatedWasteIngredients(waste, date, outletId, 7, th.wasteRepeatCount7d);
  const reconRow = recon.find((r) => r.date === date && r.outlet_id === outletId);
  const openActions = actions.filter(
    (a) => a.outlet_id === outletId && (a.status === 'OPEN' || a.status === 'IN_PROGRESS')
  );

  const today = todayWib();
  const deadlinePassed = closingDeadlinePassed(date, today, formatTimeWib(new Date()), th.closingDeadlineTime);

  return {
    date,
    outletId,
    opening: {
      hasChecklist: Boolean(header),
      completionPct: items.length > 0 ? completionPct(items) : Number(header?.completion_pct || 0),
      criticalFailed: items.length > 0 ? criticalFailedCount(items) : Number(header?.critical_failed_count || 0)
    },
    incidents: dayIncidents.map((i) => ({
      severity: i.severity, status: i.status, due_date: i.due_date, incident_type: i.incident_type
    })),
    wasteValue: wasteAgg.totalValue,
    repeatedWasteIngredients: repeated,
    cashDifference: reconRow ? Number(reconRow.cash_difference || 0) : null,
    closingApproved: reconRow?.approval_status === 'APPROVED',
    actions: openActions.map((a) => ({ status: a.status, due_date: a.due_date })),
    thresholds: { ...th, closingDeadlinePassed: deadlinePassed }
  };
}

/** Upsert one alert; auto-create action for HIGH/CRITICAL. */
async function upsertAlert(
  date: string,
  outletId: string,
  brandId: string,
  spec: AlertSpec
): Promise<{ created: boolean; updated: boolean }> {
  const id = alertId(outletId, date, spec.type);
  const existing = await findRow(TABS.alertLog, 'alert_id', id);
  const now = nowTimestampWib();
  const row: Record<string, string> = {
    alert_id: id,
    alert_datetime: now,
    alert_type: spec.type,
    severity: spec.severity,
    brand_id: brandId,
    outlet_id: outletId,
    reference_type: spec.referenceType,
    reference_id: spec.referenceId,
    title: spec.title,
    message: spec.message,
    status: existing && existing.row.status !== 'OPEN' ? existing.row.status : 'OPEN',
    assigned_to: existing?.row.assigned_to ?? '',
    due_date: shiftDate(date, 1),
    action_required: spec.actionRequired,
    telegram_status: existing?.row.telegram_status ?? 'PENDING',
    created_at: existing?.row.created_at ?? now,
    resolved_at: existing?.row.resolved_at ?? '',
    resolved_by: existing?.row.resolved_by ?? ''
  };
  if (existing) {
    // Preserve lifecycle fields; refresh message/severity
    const merged = { ...existing.row, ...row };
    await updateRow(TABS.alertLog, existing.rowNumber, merged);
  } else {
    await appendRows(TABS.alertLog, [row]);
  }

  // HIGH/CRITICAL ΓåÆ auto-create action tracker row (deterministic ID)
  if (requiresAction(spec.severity)) {
    const actId = actionId(id);
    const existingAction = await findRow(TABS.actionTracker, 'action_id', actId);
    if (!existingAction) {
      await appendRows(TABS.actionTracker, [{
        action_id: actId,
        source_alert_id: id,
        title: spec.title,
        description: spec.message,
        brand_id: brandId,
        outlet_id: outletId,
        priority: spec.severity,
        assigned_to: '',
        assigned_role: 'outlet_manager',
        due_date: shiftDate(date, 1),
        status: 'OPEN',
        action_taken: '',
        attachment_url: '',
        approved_by: '',
        created_at: now,
        updated_at: now,
        completed_at: ''
      }]);
    }
  }

  return { created: !existing, updated: Boolean(existing) };
}

/** Run the full alert engine for one (date, outlet). */
export async function runAlertEngine(date: string, outletId: string, actorUserId: string): Promise<EngineResult> {
  const outlet = await findRow(TABS.outlets, 'outlet_id', outletId);
  if (!outlet) throw new Error(`outlet not found: ${outletId}`);
  const brandId = outlet.row.brand_id;

  const ctx = await gatherContext(date, outletId);
  const specs = evaluateOpsAlerts(ctx);

  let created = 0;
  let updated = 0;
  let actionsCreated = 0;
  for (const spec of specs) {
    const before = await findRow(TABS.actionTracker, 'action_id', actionId(alertId(outletId, date, spec.type)));
    const r = await upsertAlert(date, outletId, brandId, spec);
    if (r.created) created += 1;
    if (r.updated) updated += 1;
    if (!before && requiresAction(spec.severity)) actionsCreated += 1;
    // Immediate Telegram push for newly created HIGH/CRITICAL alerts only
    // (re-upserted alerts are not re-pushed; MEDIUM/LOW are never pushed).
    if (shouldNotifyNewAlert(r.created, spec.severity)) {
      await pushAlertNotification('ops', {
        alertId: alertId(outletId, date, spec.type),
        alertType: spec.type,
        severity: spec.severity,
        title: spec.title,
        message: spec.message,
        outletName: outlet.row.outlet_name,
        date
      });
    }
  }

  await logAudit({
    module: 'ops',
    action: 'alert_engine_run',
    recordType: 'ops_alert_log',
    recordId: `${outletId}-${date}`,
    afterValue: JSON.stringify({ alerts: specs.length, created, updated, actionsCreated }),
    userId: actorUserId
  }).catch(() => null);

  return {
    date, outletId,
    alertsEvaluated: specs.length,
    alertsCreated: created,
    alertsUpdated: updated,
    actionsCreated,
    summaryId: ''
  };
}

/** Compute + upsert the ops_daily_summary row for one (date, outlet). */
export async function regenerateSummary(date: string, outletId: string): Promise<string> {
  const outlet = await findRow(TABS.outlets, 'outlet_id', outletId);
  if (!outlet) throw new Error(`outlet not found: ${outletId}`);
  const brand = await findRow(TABS.brands, 'brand_id', outlet.row.brand_id);

  const [openingHeaders, openingItems, incidents, waste, recon, briefing, actions] = await Promise.all([
    readTab<Record<string, string>>(TABS.openingChecklist),
    readTab<Record<string, string>>(TABS.openingChecklistItem),
    readTab<Record<string, string>>(TABS.incident),
    readTab<Record<string, string>>(TABS.wasteLog),
    readTab<Record<string, string>>(TABS.cashReconciliation),
    readTab<Record<string, string>>(TABS.briefing),
    readTab<Record<string, string>>(TABS.actionTracker)
  ]);

  const header = openingHeaders.find((h) => h.date === date && h.outlet_id === outletId);
  const items = header ? openingItems.filter((i) => i.checklist_id === header.checklist_id) : [];
  const dayIncidents = incidents.filter((i) => i.date === date && i.outlet_id === outletId);
  const wasteAgg = aggregateWaste(waste, date, outletId);
  const reconRow = recon.find((r) => r.date === date && r.outlet_id === outletId);
  const brief = briefing.find((b) => b.date === date && b.outlet_id === outletId);
  const openActionCount = actions.filter(
    (a) => a.outlet_id === outletId && (a.status === 'OPEN' || a.status === 'IN_PROGRESS')
  ).length;

  // Alerts for major_ops_issue / recommended_action
  const ctx = await gatherContext(date, outletId);
  const specs = evaluateOpsAlerts(ctx);

  const row = buildDailySummary({
    date,
    brandId: outlet.row.brand_id,
    brandName: brand?.row.brand_name ?? '',
    outletId,
    outletName: outlet.row.outlet_name,
    opening: {
      hasChecklist: Boolean(header),
      status: items.length > 0 ? outletReadyStatus(items) : (header?.status as never) ?? 'NOT_STARTED',
      completionPct: items.length > 0 ? completionPct(items) : Number(header?.completion_pct || 0),
      criticalFailed: items.length > 0 ? criticalFailedCount(items) : Number(header?.critical_failed_count || 0)
    },
    briefing: brief
      ? { scheduledStaff: 0, actualStaff: 0, staffingWarning: brief.staffing_warning ?? '' }
      : null,
    incidents: dayIncidents.map((i) => ({ severity: i.severity, incident_type: i.incident_type })),
    waste: wasteAgg,
    closing: {
      approved: reconRow?.approval_status === 'APPROVED',
      exists: Boolean(reconRow),
      cashDifference: reconRow ? Number(reconRow.cash_difference || 0) : null
    },
    openActionCount,
    alerts: specs
  }, nowTimestampWib());

  const id = summaryId(outletId, date);
  const existing = await findRow(TABS.dailySummary, 'summary_id', id);
  if (existing) {
    await updateRow(TABS.dailySummary, existing.rowNumber, { ...existing.row, ...row });
  } else {
    await appendRows(TABS.dailySummary, [row as unknown as Record<string, string>]);
  }
  return id;
}
