/**
 * POST /api/hr/telegram/clock-in
 * Bot-authenticated (x-bot-secret header, shared with the Hermez service).
 * The Hermez bot calls this when a linked user sends a Telegram location
 * message or `/clock-in`. The user is resolved by their bound telegram_id,
 * and GPS radius validation is enforced against their outlet.
 *
 * Returns the created attendance row, or 400 if outside radius / already in.
 */
import { readTab, appendRows, findRow, TABS } from '@/db/sheets';
import { assertEmployee, nextSequentialId } from '@/lib/repo';
import { handler, badRequest, unauthorized, ok, notFound } from '@/lib/http';
import { formatTimeWib, nowTimestampWib, todayWib } from '@/lib/format';
import { classifyLocation, parseGeoPoint } from '@/lib/attendance-geo';
import { resolveAttendanceOutlet } from '@/lib/multi-location';
import { z } from 'zod';

const schema = z.object({
  telegram_chat_id: z.string().min(1),
  latitude: z.union([z.number(), z.string()]).optional(),
  longitude: z.union([z.number(), z.string()]).optional(),
  outlet_id: z.string().optional(),
});

function botAuthorized(req: Request): boolean {
  const secret = process.env.TELEGRAM_BOT_SECRET;
  if (!secret) return false;
  const header = req.headers.get('x-bot-secret') ?? '';
  return header === secret;
}

/** Compute late minutes given scheduled vs actual (WIB HH:mm), minus tolerance. */
function computeLateMinutes(scheduled: string, actual: string, tolerance: number): number {
  if (!scheduled || !actual) return 0;
  const [sh, sm] = scheduled.split(':').map(Number);
  const [ah, am] = actual.split(':').map(Number);
  const gross = Math.max(0, ah * 60 + am - (sh * 60 + sm));
  return Math.max(0, gross - tolerance);
}

export const POST = handler(async (req) => {
  if (!botAuthorized(req)) return unauthorized('Invalid or missing x-bot-secret');
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  // Resolve the user bound to this Telegram chat id.
  const users = await readTab<Record<string, string>>(TABS.users).catch(() => []);
  const user = users.find((u) => u.telegram_id === parsed.data.telegram_chat_id && (u.active_status || 'active') === 'active');
  if (!user) return notFound('Telegram belum dihubungkan ke akun. Ketik /link KODE untuk menghubungkan.');

  const employeeId = user.employee_id;
  if (!employeeId) return badRequest('Akun kamu belum terhubung ke data karyawan. Hubungi admin HR.');

  try {
    await assertEmployee(employeeId);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : 'Missing ref');
  }

  const today = todayWib();
  const existing = await readTab<{ date: string; employee_id: string; actual_check_in: string }>(TABS.attendance);
  const dup = existing.find((a) => a.date === today && a.employee_id === employeeId);
  if (dup && dup.actual_check_in) {
    return ok({ ...(dup as Record<string, string>), already: true }, 200);
  }

  const emp = await findRow(TABS.employees, 'employee_id', employeeId);
  const employee = emp?.row;

  // Multi-location: roaming roles may choose any active outlet; others are tied
  // to their home outlet. GPS radius is ALWAYS enforced against the chosen outlet.
  let outletRow: Record<string, string> = {};
  try {
    const outletsTab = await readTab<Record<string, string>>(TABS.outlets);
    const resolved = resolveAttendanceOutlet({
      role: user.role, homeOutletId: employee?.outlet_id, requestedOutletId: parsed.data.outlet_id, outlets: outletsTab.map((o) => ({ outlet_id: o.outlet_id ?? '', outlet_name: o.outlet_name, status: o.status }))
    });
    outletRow = outletsTab.find((o) => o.outlet_id === resolved.outlet_id) ?? {};
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : 'Outlet tidak valid');
  }
  const outletId = outletRow.outlet_id ?? '';

  // Bot punches require a valid GPS point and a configured outlet geofence.
  const reported = parseGeoPoint(parsed.data.latitude, parsed.data.longitude);
  if (!reported) return badRequest('Kirim lokasi GPS Telegram sebelum absen masuk.');
  const outlet = { row: outletRow };
  const verdict = classifyLocation(reported, outlet?.row ? {
    latitude: Number(outlet.row.latitude),
    longitude: Number(outlet.row.longitude),
    attendanceRadiusM: Number(outlet.row.attendance_radius_m)
  } : null);
  if (verdict.classification === 'NO_OUTLET_GEO') return badRequest('Koordinat/radius outlet belum valid; hubungi HR.');
  if (verdict.outsideRadius) return badRequest(`Clock-in di luar radius outlet (${verdict.distanceMeters}m > ${verdict.radiusMeters}m).`);
  const checkInLocation = verdict.classification;
  const latStr = String(reported.latitude);
  const lonStr = String(reported.longitude);
  const radiusStr = String(verdict.radiusMeters);

  // Resolve today's shift from roster.
  const rosters = await readTab<{ date: string; employee_id: string; shift_id: string }>(TABS.roster);
  const todayRoster = rosters.find((r) => r.date === today && r.employee_id === employeeId);
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

  // Lateness rule tolerance per outlet.
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
    employee_id: employeeId,
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
    notes: 'clock-in via telegram',
    created_at: now,
    updated_at: now
  };
  await appendRows(TABS.attendance, [row]);
  return ok(row, 201);
});
