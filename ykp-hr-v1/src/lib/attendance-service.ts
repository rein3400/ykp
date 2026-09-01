/**
 * Shared attendance write path — used by the web clock-in/out routes AND the
 * Telegram absen webhook so lateness/radius/persistence logic is identical on
 * every path (brief §6.3).
 *
 * All Sheet I/O goes through db/sheets.ts, which transparently uses the
 * in-memory mock store when Google Sheets env is missing — so these functions
 * are unit-testable against real seeded data.
 */
import { appendRows, TABS, findRow, updateRow } from '@/db/sheets';
import { assertEmployee, nextSequentialId } from '@/lib/repo';
import {
  findTodayAttendance,
  findTodayRoster,
  findLatenessRule
} from '@/lib/attendance-lookup';
import { logAudit } from '@/lib/audit';
import { attendanceTargetGuard } from '@/lib/rbac-guard';
import { classifyLocation, parseGeoPoint } from '@/lib/attendance-geo';
import { formatTimeWib, nowTimestampWib, todayWib } from '@/lib/format';
import type { SessionUser } from '@/lib/session';

export interface AttendanceActor {
  userId: string;
  role: string;
  employeeId?: string;
}

/** Management roles clock in from anywhere (AGENTS.md §5). */
export const GEO_EXEMPT_ROLES = new Set(['owner', 'super_admin', 'hr_admin', 'finance_admin']);

export interface ServiceError {
  status: number;
  code: string;
  message: string;
}

export type ClockInOutcome =
  | { ok: true; row: Record<string, string>; already?: boolean }
  | { ok: false; error: ServiceError };

/** Compute late minutes given scheduled vs actual (WIB HH:mm), minus tolerance. */
export function computeLateMinutes(scheduled: string, actual: string, tolerance: number): number {
  if (!scheduled || !actual) return 0;
  const [sh, sm] = scheduled.split(':').map(Number);
  const [ah, am] = actual.split(':').map(Number);
  const gross = Math.max(0, ah * 60 + am - (sh * 60 + sm));
  return Math.max(0, gross - tolerance);
}

const MISSING_REF: ServiceError = { status: 400, code: 'missing_ref', message: 'Missing ref' };

/**
 * Clock an employee in for today (WIB). Handles:
 * - employee existence + self-only RBAC
 * - idempotent day lock (second call returns already:true, not an error)
 * - outlet geofence when coordinates are supplied
 * - today's roster/shift lateness + per-outlet tolerance
 */
export async function performClockIn(input: {
  employeeId: string;
  latitude?: number | string;
  longitude?: number | string;
  actor: AttendanceActor;
  source: 'web' | 'telegram';
}): Promise<ClockInOutcome> {
  try {
    await assertEmployee(input.employeeId);
  } catch (e) {
    return { ok: false, error: { status: 400, code: 'missing_ref', message: e instanceof Error ? e.message : MISSING_REF.message } };
  }

  const guard = attendanceTargetGuard(
    input.actor as SessionUser,
    input.employeeId
  );
  if (guard.forbidden) {
    return { ok: false, error: { status: 403, code: 'forbidden', message: guard.reason ?? 'Forbidden' } };
  }

  const today = todayWib();
  const dup = await findTodayAttendance(input.employeeId, today);
  if (dup && dup.actual_check_in) {
    return { ok: true, row: dup as Record<string, string>, already: true };
  }

  const emp = await findRow(TABS.employees, 'employee_id', input.employeeId);
  const employee = emp?.row;
  const outletId = employee?.outlet_id ?? '';

  let checkInLocation = '';
  let latStr = '';
  let lonStr = '';
  let radiusStr = '';
  const reportedGeo = parseGeoPoint(input.latitude, input.longitude);
  if (reportedGeo) {
    latStr = String(reportedGeo.latitude);
    lonStr = String(reportedGeo.longitude);
    const outlet = outletId ? await findRow(TABS.outlets, 'outlet_id', outletId) : null;
    const verdict = classifyLocation(reportedGeo, outlet?.row
      ? {
          latitude: Number(outlet.row.latitude),
          longitude: Number(outlet.row.longitude),
          attendanceRadiusM: Number(outlet.row.attendance_radius_m)
        }
      : null);
    checkInLocation = verdict.classification;
    radiusStr = verdict.radiusMeters ? String(verdict.radiusMeters) : '';
    if (verdict.outsideRadius) {
      // Management roles are mobile (meetings, audits, multiple outlets) —
      // they clock in from anywhere (AGENTS.md §5). The row still records
      // OUTSIDE_RADIUS so the trail is honest.
      if (!GEO_EXEMPT_ROLES.has((input.actor.role ?? '').toLowerCase())) {
        return {
          ok: false,
          error: {
            status: 400,
            code: 'bad_request',
            message: `Clock-in di luar radius outlet (${verdict.distanceMeters}m > ${verdict.radiusMeters}m). Ajukan koreksi manual.`
          }
        };
      }
    }
  }

  const todayRoster = await findTodayRoster(input.employeeId, today);
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

  const rule = await findLatenessRule(outletId);
  const tolerance = Number(rule?.tolerance_minutes ?? 10);

  const timeNow = formatTimeWib(new Date());
  const lateMinutes = computeLateMinutes(scheduledIn, timeNow, tolerance);
  const status = lateMinutes > 0 ? 'LATE' : 'PRESENT';

  const attendanceId = await nextSequentialId('attendance', 'attendance_id', 'ATT');
  const now = nowTimestampWib();

  const row: Record<string, string> = {
    attendance_id: attendanceId,
    date: today,
    employee_id: input.employeeId,
    employee_name: employee?.full_name ?? '',
    brand_id: employee?.brand_id ?? '',
    outlet_id: outletId,
    shift_id: shiftId,
    scheduled_check_in: scheduledIn,
    actual_check_in: timeNow,
    scheduled_check_out: scheduledOut,
    actual_check_out: '',
    check_in_location: checkInLocation,
    check_out_location: '',
    latitude: latStr,
    longitude: lonStr,
    attendance_radius_m: radiusStr,
    check_in_photo_url: '',
    check_out_photo_url: '',
    attendance_status: status,
    late_minutes: String(lateMinutes),
    early_leave_minutes: '0',
    overtime_minutes: '0',
    correction_status: '',
    correction_reason: '',
    approved_by: '',
    notes: `clock-in via ${input.source}`,
    created_at: now,
    updated_at: now
  };
  await appendRows(TABS.attendance, [row]);
  await logAudit({
    actorUserId: input.actor.userId,
    actorRole: input.actor.role,
    action: 'create',
    entity: 'attendance',
    entityId: attendanceId,
    afterValue: `clock-in ${status} late=${lateMinutes}min source=${input.source}`
  });
  return { ok: true, row };
}

export type ClockOutOutcome =
  | { ok: true; row: Record<string, string> }
  | { ok: false; error: ServiceError };

/** Clock an employee out by attendance_id. */
export async function performClockOut(input: {
  attendanceId: string;
  actor: AttendanceActor;
  source: 'web' | 'telegram';
}): Promise<ClockOutOutcome> {
  const found = await findRow(TABS.attendance, 'attendance_id', input.attendanceId);
  if (!found) return { ok: false, error: { status: 404, code: 'not_found', message: 'Attendance not found' } };
  if (found.row.actual_check_out) return { ok: false, error: { status: 409, code: 'conflict', message: 'Already clocked out' } };

  if (input.actor.role === 'employee') {
    const guard = attendanceTargetGuard(input.actor as SessionUser, found.row.employee_id);
    if (guard.forbidden) return { ok: false, error: { status: 403, code: 'forbidden', message: guard.reason ?? 'Forbidden' } };
  }

  const timeNow = formatTimeWib(new Date());
  const updated = {
    ...found.row,
    actual_check_out: timeNow,
    updated_at: nowTimestampWib()
  };
  await updateRow(TABS.attendance, found.rowNumber, updated);
  await logAudit({
    actorUserId: input.actor.userId,
    actorRole: input.actor.role,
    action: 'update',
    entity: 'attendance',
    entityId: input.attendanceId,
    afterValue: `clock-out source=${input.source}`
  });
  return { ok: true, row: updated };
}
