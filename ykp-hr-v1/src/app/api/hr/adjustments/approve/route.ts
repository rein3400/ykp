import { updateRow, TABS, findRow } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, unauthorized, forbidden, conflict, ok, notFound } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { z } from 'zod';

const schema = z.object({ adjustment_id: z.string().min(1), decision: z.enum(['APPROVE', 'REJECT']) });

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'approve', 'adjustment')) return forbidden();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const found = await findRow(TABS.adjustments, 'adjustment_id', parsed.data.adjustment_id);
  if (!found) return notFound('Adjustment not found');
  if (found.row.approval_status !== 'PENDING') return conflict('Already decided');

  const updated = {
    ...found.row,
    approval_status: parsed.data.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    approved_by: session.userId
  };
  await updateRow(TABS.adjustments, found.rowNumber, updated);
  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: parsed.data.decision === 'APPROVE' ? 'approve' : 'reject',
    entity: 'adjustment',
    entityId: parsed.data.adjustment_id
  });
  return ok(updated);
});