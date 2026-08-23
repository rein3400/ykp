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
import { z } from 'zod';

const schema = z.object({
  telegram_chat_id: z.string().min(1),
  latitude: z.union([z.number(), z.string()]).optional(),
  longitude: z.union([z.number(), z.string()]).optional(),
});

function botAuthorized(req: Request): boolean {
  const secret = process.env.TELEGRAM_BOT_SECRET;
  if (!secret) return false;
  const header = req.headers.get('x-bot-secret') ?? '';
  return header === secret;
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
