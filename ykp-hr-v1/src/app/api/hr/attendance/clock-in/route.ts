/**
 * Quick clock-in: today WIB, no body required except employee_id.
 * Returns 409 if already clocked in today.
 */
import { readTab, appendRows, TABS, findRow } from '@/db/sheets';
import { assertEmployee, nextSequentialId } from '@/lib/repo';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, missingRef, conflict, unauthorized, ok } from '@/lib/http';
import { can } from '@/lib/rbac';
import { formatTimeWib, nowTimestampWib, todayWib } from '@/lib/format';
import { z } from 'zod';

const schema = z.object({ employee_id: z.string().min(1) });

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as any, 'create', 'attendance')) return unauthorized();
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
  const attendanceId = await nextSequentialId('attendance', 'attendance_id', 'ATT');
  const now = nowTimestampWib();
  const timeNow = formatTimeWib(new Date());

  const row: Record<string, string> = {
    attendance_id: attendanceId,
    date: today,
    employee_id: parsed.data.employee_id,
    employee_name: emp?.row.full_name ?? '',
    brand_id: emp?.row.brand_id ?? '',
    outlet_id: emp?.row.outlet_id ?? '',
    shift_id: '',
    scheduled_check_in: '',
    actual_check_in: timeNow,
    scheduled_check_out: '',
    actual_check_out: '',
    check_in_location: '',
    check_out_location: '',
    latitude: '',
    longitude: '',
    attendance_radius_m: '',
    check_in_photo_url: '',
    check_out_photo_url: '',
    attendance_status: 'PRESENT',
    late_minutes: '0',
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
    afterValue: 'clock-in'
  });
  return ok(row, 201);
});
