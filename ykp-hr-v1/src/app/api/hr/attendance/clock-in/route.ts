/**
 * Quick clock-in: today WIB, no body required except employee_id.
 * Resolves today's roster + shift to detect lateness per brief §6.3.
 * Returns 409 if already clocked in today.
 */
import { readTab, appendRows, TABS, findRow } from '@/db/sheets';
import { assertEmployee, nextSequentialId } from '@/lib/repo';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, missingRef, conflict, unauthorized, ok } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { formatTimeWib, nowTimestampWib, todayWib } from '@/lib/format';
import { z } from 'zod';

const schema = z.object({ employee_id: z.string().min(1) });

/** Compute late minutes given scheduled vs actual (WIB HH:mm), minus tolerance. */
function computeLateMinutes(scheduled: string, actual: string, tolerance: number): number {
  if (!scheduled || !actual) return 0;
  const [sh, sm] = scheduled.split(':').map(Number);
  const [ah, am] = actual.split(':').map(Number);
  const gross = Math.max(0, ah * 60 + am - (sh * 60 + sm));
  return Math.max(0, gross - tolerance);
}

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'create', 'attendance')) return unauthorized();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    await assertEmployee(parsed.data.employee_id);
  } catch (e) {
    return missingRef(e instanceof Error ? e.message : 'Missing ref');
  }

  const today = todayWib();
  const existing = await readTab<{ date: string; employee_id: string; actual_check_in: string }>(TABS.attendance);
  const dup = existing.find((a) => a.date === today && a.employee_id === parsed.data.employee_id);
  if (dup && dup.actual_check_in) return conflict('Already clocked in today');

  const emp = await findRow(TABS.employees, 'employee_id', parsed.data.employee_id);
  const employee = emp?.row;
  const outletId = employee?.outlet_id ?? '';

  // Resolve today's shift from roster (brief §6.3: deteksi telat vs shift).
  const rosters = await readTab<{ date: string; employee_id: string; shift_id: string }>(TABS.roster);
  const todayRoster = rosters.find((r) => r.date === today && r.employee_id === parsed.data.employee_id);
  let shiftId = '';
  let scheduledIn = '';
  let scheduledOut = '';
  if (todayRoster?.shift_id) {
    shiftId = todayRoster.shift_id;
    const shift = await findRow(TABS.shifts, 'shift_id', shiftId);
    if (shift) {
      scheduledIn = shift.row.start_time;
      scheduledOut = shift.row.end_time;
    }
  }

  // Lateness rule tolerance per outlet (brief §6.5).
  const rules = await readTab<{ outlet_id: string; tolerance_minutes: string }>(TABS.latenessRules);
  const rule = rules.find((r) => r.outlet_id === outletId) ?? rules[0];
  const tolerance = Number(rule?.tolerance_minutes ?? 10);

  const timeNow = formatTimeWib(new Date());
  const lateMinutes = computeLateMinutes(scheduledIn, timeNow, tolerance);
  const status = lateMinutes > 0 ? 'LATE' : 'PRESENT';

  const attendanceId = await nextSequentialId('attendance', 'attendance_id', 'ATT');
  const now = nowTimestampWib();

  const row: Record<string, string> = {
    attendance_id: attendanceId,
    date: today,
    employee_id: parsed.data.employee_id,
    employee_name: employee?.full_name ?? '',
    brand_id: employee?.brand_id ?? '',
    outlet_id: outletId,
    shift_id: shiftId,
    scheduled_check_in: scheduledIn,
    actual_check_in: timeNow,
    scheduled_check_out: scheduledOut,
    actual_check_out: '',
    check_in_location: '',
    check_out_location: '',
    latitude: '',
    longitude: '',
    attendance_radius_m: '',
    check_in_photo_url: '',
    check_out_photo_url: '',
    attendance_status: status,
    late_minutes: String(lateMinutes),
    early_leave_minutes: '0',
    overtime_minutes: '0',
    correction_status: '',
    correction_reason: '',
    approved_by: '',
    notes: 'clock-in via web',
    created_at: now,
    updated_at: now
  };
  await appendRows(TABS.attendance, [row]);
  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'create',
    entity: 'attendance',
    entityId: attendanceId,
    afterValue: `clock-in ${status} late=${lateMinutes}min`
  });
  return ok(row, 201);
});