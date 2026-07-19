/**
 * Quick clock-in: today WIB, no body required except employee_id.
 * Resolves today's roster + shift to detect lateness per brief §6.3.
 * Returns 409 if already clocked in today.
 */
import { readTab, appendRows, TABS, findRow } from '@/db/sheets';
import { assertEmployee, nextSequentialId } from '@/lib/repo';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, missingRef, unauthorized, ok } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { formatTimeWib, nowTimestampWib, todayWib } from '@/lib/format';
import { z } from 'zod';

const schema = z.object({
  employee_id: z.string().min(1),
  latitude: z.union([z.number(), z.string()]).optional(),
  longitude: z.union([z.number(), z.string()]).optional(),
});

/** Compute late minutes given scheduled vs actual (WIB HH:mm), minus tolerance. */
function computeLateMinutes(scheduled: string, actual: string, tolerance: number): number {
  if (!scheduled || !actual) return 0;
  const [sh, sm] = scheduled.split(':').map(Number);
  const [ah, am] = actual.split(':').map(Number);
  const gross = Math.max(0, ah * 60 + am - (sh * 60 + sm));
  return Math.max(0, gross - tolerance);
}

/** Haversine distance in meters. */
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'create', 'attendance')) return unauthorized();
  // Safe parse — req.json() on empty/invalid body throws and surfaces as a
  // 500 (VERIFICATION_REPORT P2: multi-click 5xx). Treat as bad request.
  const body = await req.json().catch(() => ({}));
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
  // Idempotent day lock: a second clock-in today is not an error — return the
  // existing row with 200 + already:true so multi-click / double-tap is
  // harmless (was 409 + occasional 5xx under race).
  if (dup && dup.actual_check_in) return ok({ ...(dup as Record<string, string>), already: true }, 200);

  const emp = await findRow(TABS.employees, 'employee_id', parsed.data.employee_id);
  const employee = emp?.row;
  const outletId = employee?.outlet_id ?? '';

  // GPS radius validation (optional coords; if provided, enforce outlet radius).
  let checkInLocation = '';
  let latStr = '';
  let lonStr = '';
  let radiusStr = '';
  if (parsed.data.latitude != null && parsed.data.longitude != null) {
    const lat = Number(parsed.data.latitude);
    const lon = Number(parsed.data.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return badRequest('latitude/longitude invalid');
    }
    latStr = String(lat);
    lonStr = String(lon);
    if (outletId) {
      const outlet = await findRow(TABS.outlets, 'outlet_id', outletId);
      const oLat = Number(outlet?.row.latitude ?? NaN);
      const oLon = Number(outlet?.row.longitude ?? NaN);
      const radius = Number(outlet?.row.attendance_radius_m ?? 0);
      radiusStr = radius ? String(radius) : '';
      if (Number.isFinite(oLat) && Number.isFinite(oLon) && radius > 0) {
        const dist = distanceMeters(lat, lon, oLat, oLon);
        checkInLocation = dist <= radius ? 'INSIDE_RADIUS' : 'OUTSIDE_RADIUS';
        if (dist > radius) {
          return badRequest(
            `Clock-in di luar radius outlet (${Math.round(dist)}m > ${radius}m). Ajukan koreksi manual.`
          );
        }
      } else {
        checkInLocation = 'NO_OUTLET_GEO';
      }
    }
  }

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