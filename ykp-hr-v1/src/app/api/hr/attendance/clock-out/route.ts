/**
 * Quick clock-out: update existing attendance row by attendance_id.
 */
import { getSession } from '@/lib/session';
import { handler, badRequest, conflict, unauthorized, forbidden, ok, notFound } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { performClockOut } from '@/lib/attendance-service';
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

  const result = await performClockOut({
    attendanceId: parsed.data.attendance_id,
    actor: { userId: session.userId, role: session.role, employeeId: session.employeeId },
    source: 'web'
  });

  if (!result.ok) {
    const e = result.error;
    if (e.status === 404) return notFound(e.message);
    if (e.status === 409) return conflict(e.message);
    if (e.status === 403) return forbidden(e.message);
    return badRequest(e.message);
  }
  return ok(result.row);
});
