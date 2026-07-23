/**
 * Quick clock-out: update existing attendance row by attendance_id.
 */
import { readTab, updateRow, TABS, findRow } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, conflict, unauthorized, forbidden, ok, notFound } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { attendanceTargetGuard } from '@/lib/rbac-guard';
import { formatTimeWib, nowTimestampWib } from '@/lib/format';
import { z } from 'zod';

const schema = z.object({ attendance_id: z.string().min(1) });

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  // EMPLOYEE has attendance:create but not attendance:update in the matrix —
  // allow clock-out for their own row via create (self). Outlet managers keep
  // update. Fall through to create for employee so self clock-out works.
  const role = session.role as Role;
  const canUpdate = can(role, 'update', 'attendance');
  const canCreate = can(role, 'create', 'attendance');
  if (!canUpdate && !canCreate) return unauthorized();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const found = await findRow(TABS.attendance, 'attendance_id', parsed.data.attendance_id);
  if (!found) return notFound('Attendance not found');
  if (found.row.actual_check_out) return conflict('Already clocked out');

  // RBAC: EMPLOYEE may only clock out their own attendance row.
  if (role === 'employee') {
    const guard = attendanceTargetGuard(session, found.row.employee_id);
    if (guard.forbidden) return forbidden(guard.reason ?? 'Forbidden');
  }

  const timeNow = formatTimeWib(new Date());
  const updated = {
    ...found.row,
    actual_check_out: timeNow,
    updated_at: nowTimestampWib()
  };
  await updateRow(TABS.attendance, found.rowNumber, updated);
  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'update',
    entity: 'attendance',
    entityId: parsed.data.attendance_id,
    afterValue: 'clock-out'
  });
  return ok(updated);
});
