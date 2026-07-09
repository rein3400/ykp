import { updateRow, TABS, findRow } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, unauthorized, forbidden, conflict, ok, notFound } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { z } from 'zod';

const schema = z.object({ leave_id: z.string().min(1), decision: z.enum(['APPROVE', 'REJECT']), reason: z.string().default('') });

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'approve', 'leave')) return forbidden();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const found = await findRow(TABS.leaves, 'leave_id', parsed.data.leave_id);
  if (!found) return notFound('Leave not found');
  if (found.row.approval_status !== 'PENDING') return conflict('Leave already decided');

  const updated = {
    ...found.row,
    approval_status: parsed.data.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    approved_by: session.userId,
    approved_at: nowTimestampWib(),
    rejection_reason: parsed.data.reason
  };
  await updateRow(TABS.leaves, found.rowNumber, updated);
  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: parsed.data.decision === 'APPROVE' ? 'approve' : 'reject',
    entity: 'leave',
    entityId: parsed.data.leave_id,
    reason: parsed.data.reason
  });
  return ok(updated);
});
