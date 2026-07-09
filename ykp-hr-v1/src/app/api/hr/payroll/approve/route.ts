/**
 * Approve a payroll row. PENDING -> APPROVED, sets approved_by + updated_at.
 * Owner/HR Admin/Finance Admin only.
 */
import { updateRow, TABS, findRow } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, unauthorized, forbidden, conflict, ok, notFound } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { z } from 'zod';

const schema = z.object({
  payroll_id: z.string().min(1),
  decision: z.enum(['APPROVE', 'REJECT'])
});

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'approve', 'payroll')) return forbidden();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const found = await findRow(TABS.payroll, 'payroll_id', parsed.data.payroll_id);
  if (!found) return notFound('Payroll not found');
  if (found.row.approval_status !== 'PENDING') return conflict(`Payroll is ${found.row.approval_status}, cannot decide`);

  const updated = {
    ...found.row,
    approval_status: parsed.data.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    payment_status: parsed.data.decision === 'APPROVE' ? 'READY_TO_PAY' : found.row.payment_status,
    approved_by: session.userId,
    updated_at: nowTimestampWib()
  };
  await updateRow(TABS.payroll, found.rowNumber, updated);
  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: parsed.data.decision === 'APPROVE' ? 'approve' : 'reject',
    entity: 'payroll',
    entityId: parsed.data.payroll_id
  });
  return ok(updated);
});
