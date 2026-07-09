/**
 * Regenerate hr_daily_summary for a date, per outlet.
 * Idempotent: writes are by (outlet_id, date) summary_id.
 * Also writes hermes_alert_log rows per brief §11.
 */
import { readTab, appendRows, TABS, findRow, updateRow } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, unauthorized, forbidden, ok } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { buildSummary, type SummaryInput } from '@/features/hr/lib/summary';
import { generateAlerts, type HermesAlert } from '@/lib/hermez-alerts';
import { z } from 'zod';

const schema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

interface Employee { employee_id: string; full_name: string; brand_id: string; outlet_id: string; active_status: string }
interface Attendance { date: string; employee_id: string; outlet_id: string; attendance_status: string; late_minutes: string; overtime_minutes: string; actual_check_out: string }
interface Roster { date: string; employee_id: string; outlet_id: string; shift_id: string; roster_status: string }
interface Payroll { payroll_period: string; outlet_id: string; employee_id: string; approval_status: string }
interface Brand { brand_id: string; brand_name: string }
interface Outlet { outlet_id: string; brand_id: string; outlet_name: string; status: string }
interface Leave { employee_id: string; start_date: string; end_date: string; approval_status: string }

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'generate', 'summary')) return forbidden();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const date = parsed.data.date;
  const [employees, attendance, rosters, payrolls, brands, outlets, leaves] = await Promise.all([
    readTab<Employee>(TABS.employees),
    readTab<Attendance>(TABS.attendance),
    readTab<Roster>(TABS.roster),
    readTab<Payroll>(TABS.payroll),
    readTab<Brand>(TABS.brands),
    readTab<Outlet>(TABS.outlets),
    readTab<Leave>(TABS.leaves)
  ]);
  const brandById = new Map(brands.map((b) => [b.brand_id, b.brand_name]));

  // For each outlet: compute aggregates for that date
  const out = outlets.filter((o) => o.status === 'active' || o.status === 'pilot' || o.status === '');
  const summaryRows: Record<string, string>[] = [];
  const newAlertRows: Record<string, string>[] = [];
  const updateAlerts: Array<{ rowNumber: number; row: Record<string, string> }> = [];
  const now = nowTimestampWib();

  for (const o of out) {
    const outletEmployees = employees.filter((e) => e.outlet_id === o.outlet_id && (e.active_status === 'active' || e.active_status === '1'));
    const outletAtt = attendance.filter((a) => a.outlet_id === o.outlet_id && a.date === date);
    const todayRoster = rosters.filter((r) => r.outlet_id === o.outlet_id && r.date === date);

    // Counts per brief §7 / §11.
    const present = outletAtt.filter((a) => a.attendance_status === 'PRESENT' || a.attendance_status === 'LATE').length;
    const late = outletAtt.filter((a) => a.attendance_status === 'LATE').length;
    // staff_absent = actual ABSENT status (brief §11: "absent tanpa keterangan").
    const absent = outletAtt.filter((a) => a.attendance_status === 'ABSENT').length;
    // staff_leave = approved leaves overlapping this date for outlet employees.
    const outletEmpIds = new Set(outletEmployees.map((e) => e.employee_id));
    const staffLeave = leaves.filter((l) => {
      if (l.approval_status !== 'APPROVED') return false;
      if (!outletEmpIds.has(l.employee_id)) return false;
      return l.start_date <= date && l.end_date >= date;
    }).length;
    const incomplete = outletAtt.filter((a) => !a.actual_check_out).length;
    const totalLateMinutes = outletAtt.reduce((s, a) => s + Number(a.late_minutes || 0), 0);
    const overtimeHours = Math.round(outletAtt.reduce((s, a) => s + Number(a.overtime_minutes || 0), 0) / 60);
    const shiftShortage = todayRoster.filter((r) => !r.shift_id).length;
    const payrollIssues = payrolls.filter(
      (p) => p.outlet_id === o.outlet_id && p.approval_status === 'PENDING'
    ).length;

    const input: SummaryInput = {
      date,
      brand_id: o.brand_id,
      brand_name: brandById.get(o.brand_id) ?? o.brand_id,
      outlet_id: o.outlet_id,
      outlet_name: o.outlet_name,
      total_staff: outletEmployees.length,
      scheduled_staff: todayRoster.length,
      staff_present: present,
      staff_late: late,
      staff_absent: absent,
      staff_leave: staffLeave,
      incomplete_attendance: incomplete,
      total_late_minutes: totalLateMinutes,
      overtime_hours: overtimeHours,
      shift_shortage: shiftShortage,
      payroll_issue_count: payrollIssues
    };
    const result = buildSummary(input, now);

    // Map to sheet columns
    const row: Record<string, string> = {
      summary_id: result.summary_id,
      date: result.date,
      brand_id: result.brand_id,
      brand_name: result.brand_name,
      outlet_id: result.outlet_id,
      outlet_name: result.outlet_name,
      total_staff: String(result.total_staff),
      scheduled_staff: String(result.scheduled_staff),
      staff_present: String(result.staff_present),
      staff_late: String(result.staff_late),
      staff_absent: String(result.staff_absent),
      staff_leave: String(result.staff_leave),
      incomplete_attendance: String(result.incomplete_attendance),
      total_late_minutes: String(result.total_late_minutes),
      overtime_hours: String(result.overtime_hours),
      shift_shortage: String(result.shift_shortage),
      payroll_issue_count: String(result.payroll_issue_count),
      major_hr_issue: result.major_hr_issue,
      recommended_action: result.recommended_action,
      created_at: result.created_at
    };

    // Idempotency: if exists for (outlet, date), update; else append.
    const existing = await findRow(TABS.dailySummary, 'summary_id', result.summary_id);
    if (existing) {
      await updateRow(TABS.dailySummary, existing.rowNumber, row);
    } else {
      summaryRows.push(row);
    }

    // Generate alerts (brief §11) and upsert each.
    const inactiveIds = new Set(outletEmployees.filter((e) => e.active_status !== 'active' && e.active_status !== '1').map((e) => e.employee_id));
    const hasInactiveInRoster = todayRoster.some((r) => inactiveIds.has(r.employee_id));
    const alerts = generateAlerts({
      date,
      brand_name: result.brand_name,
      outlet_id: result.outlet_id,
      outlet_name: result.outlet_name,
      staff_late: late,
      staff_absent: absent,
      staff_leave: staffLeave,
      staff_present: present,
      incomplete_attendance: incomplete,
      shift_shortage: shiftShortage,
      total_late_minutes: totalLateMinutes,
      payroll_pending_count: payrollIssues,
      has_inactive_in_roster: hasInactiveInRoster
    }, now);
    for (const a of alerts) {
      const existingAlert = await findRow(TABS.hermezAlerts, 'alert_id', a.alert_id);
      if (existingAlert) {
        updateAlerts.push({ rowNumber: existingAlert.rowNumber, row: alertToRow(a) });
      } else {
        newAlertRows.push(alertToRow(a));
      }
    }
  }

  if (summaryRows.length > 0) {
    await appendRows(TABS.dailySummary, summaryRows);
  }
  if (newAlertRows.length > 0) {
    await appendRows(TABS.hermezAlerts, newAlertRows);
  }
  for (const u of updateAlerts) {
    await updateRow(TABS.hermezAlerts, u.rowNumber, u.row);
  }

  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'generate',
    entity: 'summary',
    entityId: date,
    afterValue: `${out.length} outlets, ${newAlertRows.length + updateAlerts.length} alerts`
  });

  return ok({
    date,
    count: out.length,
    total_rows: out.length,
    alerts_created: newAlertRows.length,
    alerts_updated: updateAlerts.length
  });
});

function alertToRow(a: HermesAlert): Record<string, string> {
  return {
    alert_id: a.alert_id,
    date: a.date,
    brand: a.brand,
    outlet: a.outlet,
    source_app: a.source_app,
    alert_type: a.alert_type,
    severity: a.severity,
    message: a.message,
    status: a.status,
    assigned_to: a.assigned_to,
    action_taken: a.action_taken,
    created_at: a.created_at,
    resolved_at: a.resolved_at
  };
}