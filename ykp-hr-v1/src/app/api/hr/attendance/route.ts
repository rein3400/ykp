import { readTab, appendRows, TABS, findRow } from '@/db/sheets';
import { assertEmployee, assertOutlet, assertShift, nextSequentialId } from '@/lib/repo';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, list, badRequest, missingRef, conflict, unauthorized, forbidden, ok } from '@/lib/http';
import { can } from '@/lib/rbac';
import { formatTimeWib, nowTimestampWib, todayWib } from '@/lib/format';
import { z } from 'zod';

const insertSchema = z.object({
  employee_id: z.string().min(1),
  outlet_id: z.string().min(1).optional(),
  shift_id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  actual_check_in: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  actual_check_out: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  scheduled_check_in: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  scheduled_check_out: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'SICK', 'OFF', 'INCOMPLETE', 'MANUAL_CORRECTION']).default('PRESENT'),
  late_minutes: z.coerce.number().min(0).default(0),
  overtime_minutes: z.coerce.number().min(0).default(0),
  notes: z.string().default('')
});

/** Compute late minutes given scheduled vs actual (WIB HH:mm). */
function computeLateMinutes(scheduled: string, actual: string): number {
  if (!scheduled || !actual) return 0;
  const [sh, sm] = scheduled.split(':').map(Number);
  const [ah, am] = actual.split(':').map(Number);
  return Math.max(0, ah * 60 + am - (sh * 60 + sm));
}

/** Compute early leave minutes. */
function computeEarlyLeaveMinutes(scheduled: string, actual: string): number {
  if (!scheduled || !actual) return 0;
  const [sh, sm] = scheduled.split(':').map(Number);
  const [ah, am] = actual.split(':').map(Number);
  return Math.max(0, sh * 60 + sm - (ah * 60 + am));
}

export const GET = handler(async () => {
  const rows = await readTab<Record<string, string>>(TABS.attendance);
  return list(rows);
});

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as any, 'create', 'attendance')) return forbidden();

  const body = await req.json();
  const parsed = insertSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    await assertEmployee(parsed.data.employee_id);
    if (parsed.data.outlet_id) await assertOutlet(parsed.data.outlet_id);
    if (parsed.data.shift_id) await assertShift(parsed.data.shift_id);
  } catch (e) {
    return missingRef(e instanceof Error ? e.message : 'Missing ref');
  }

  // Resolve outlet if not provided: from employee record.
  let outletId = parsed.data.outlet_id;
  if (!outletId) {
    const emp = await findRow(TABS.employees, 'employee_id', parsed.data.employee_id);
    outletId = emp?.row.outlet_id;
  }

  // Lookup shift to compute late + early leave + overtime if not provided.
  let scheduledIn = parsed.data.scheduled_check_in;
  let scheduledOut = parsed.data.scheduled_check_out;
  if (parsed.data.shift_id) {
    const sh = await findRow(TABS.shifts, 'shift_id', parsed.data.shift_id);
    if (sh) {
      scheduledIn = scheduledIn || sh.row.start_time;
      scheduledOut = scheduledOut || sh.row.end_time;
    }
  }

  // Lookup lateness rule for tolerance
  const rules = await readTab<{ outlet_id: string; tolerance_minutes: string }>(TABS.latenessRules);
  const rule = rules.find((r) => r.outlet_id === outletId) ?? rules[0];
  const tolerance = Number(rule?.tolerance_minutes ?? 10);

  let lateMin = parsed.data.late_minutes;
  let earlyMin = 0;
  let otMin = parsed.data.overtime_minutes;

  if (parsed.data.actual_check_in && scheduledIn) {
    const gross = computeLateMinutes(scheduledIn, parsed.data.actual_check_in);
    lateMin = Math.max(0, gross - tolerance);
  }
  if (parsed.data.actual_check_out && scheduledOut) {
    earlyMin = computeEarlyLeaveMinutes(scheduledOut, parsed.data.actual_check_out);
  }
  if (parsed.data.actual_check_out && scheduledOut && !earlyMin) {
    // overtime if check out > scheduled
    const [sh, sm] = scheduledOut.split(':').map(Number);
    const [ah, am] = parsed.data.actual_check_out.split(':').map(Number);
    const over = Math.max(0, ah * 60 + am - (sh * 60 + sm));
    if (over > 0) otMin = over;
  }

  // Auto status: if check-in present and late_minutes > 0 => LATE
  let status = parsed.data.status;
  if (parsed.data.actual_check_in && lateMin > 0 && status === 'PRESENT') status = 'LATE';
  if (!parsed.data.actual_check_in && !parsed.data.actual_check_out && status === 'PRESENT') status = 'ABSENT';
  if (parsed.data.actual_check_in && !parsed.data.actual_check_out && new Date(parsed.data.date) <= new Date(todayWib())) {
    // not yet clocked out → mark INCOMPLETE only if past the day
  }

  // Idempotency: one attendance per (date, employee_id). Reject duplicate.
  const existing = await readTab<{ attendance_id: string; date: string; employee_id: string }>(TABS.attendance);
  const dup = existing.find((a) => a.date === parsed.data.date && a.employee_id === parsed.data.employee_id);
  if (dup) return conflict('Attendance for this employee+date already exists');

  const attendanceId = await nextSequentialId('attendance', 'attendance_id', 'ATT');
  const now = nowTimestampWib();

  const empRow = await findRow(TABS.employees, 'employee_id', parsed.data.employee_id);

  const row: Record<string, string> = {
    attendance_id: attendanceId,
    date: parsed.data.date,
    employee_id: parsed.data.employee_id,
    employee_name: empRow?.row.full_name ?? '',
    brand_id: empRow?.row.brand_id ?? '',
    outlet_id: outletId ?? '',
    shift_id: parsed.data.shift_id ?? '',
    scheduled_check_in: scheduledIn ?? '',
    actual_check_in: parsed.data.actual_check_in ?? '',
    scheduled_check_out: scheduledOut ?? '',
    actual_check_out: parsed.data.actual_check_out ?? '',
    check_in_location: '',
    check_out_location: '',
    latitude: '',
    longitude: '',
    attendance_radius_m: '',
    check_in_photo_url: '',
    check_out_photo_url: '',
    attendance_status: status,
    late_minutes: String(lateMin),
    early_leave_minutes: String(earlyMin),
    overtime_minutes: String(otMin),
    correction_status: '',
    correction_reason: '',
    approved_by: '',
    notes: parsed.data.notes,
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
    afterValue: JSON.stringify({ date: parsed.data.date, employee_id: parsed.data.employee_id, status, lateMin })
  });

  return ok(row, 201);
});
