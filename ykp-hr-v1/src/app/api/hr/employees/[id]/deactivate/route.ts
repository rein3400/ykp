import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, notFound, unauthorized, forbidden, ok, badRequest } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';

export const POST = handler(async (_req, ctx) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'update', 'employee')) return forbidden();

  const id = ctx?.params?.id;
  if (!id) return badRequest('id required');

  const found = await findRow(TABS.employees, 'employee_id', id);
  if (!found) return notFound('employee not found');

  if (found.row.active_status === 'inactive') {
    return ok({ ...found.row, active_status: 'inactive' }, 200);
  }

  const now = nowTimestampWib();
  const merged: Record<string, string> = {
    ...found.row,
    active_status: 'inactive',
    updated_at: now,
    updated_by: session.userId
  };

  await updateRow(TABS.employees, found.rowNumber, merged);

  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'deactivate',
    entity: 'employee',
    entityId: id,
    beforeValue: JSON.stringify({ active_status: found.row.active_status }),
    afterValue: JSON.stringify({ active_status: 'inactive' })
  });

  return ok(merged);
});