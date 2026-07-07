/**
 * Mark payroll as PAID. APPROVED -> PAID. Finance Admin only.
 */
import { updateRow, TABS, findRow } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, unauthorized, forbidden, conflict, ok, notFound } from '@/lib/http';
import { can } from '@/lib/rbac';
import { nowTimestampWib, todayWib } from '@/lib/format';
import { z } from 'zod';

const schema = z.object({
  payroll_id: z.string().min(1),
  payment_reference: z.string().default('')
});

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as any, 'mark_paid', 'payroll')) return forbidden();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const found = await findRow(TABS.payroll, 'payroll_id', parsed.data.payroll_id);
  if (!found) return notFound('Payroll not found');
  if (found.row.approval_status !== 'APPROVED') return conflict('Only APPROVED payroll can be marked paid');
  if (found.row.payment_status === 'PAID') return conflict('Already paid');

  const updated = {
    ...found.row,
    payment_status: 'PAID',
    payment_date: todayWib(),
    payment_reference: parsed.data.payment_reference,
    updated_at: nowTimestampWib()
  };
  await updateRow(TABS.payroll, found.rowNumber, updated);
  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'mark_paid',
    entity: 'payroll',
    entityId: parsed.data.payroll_id
  });
  return ok(updated);
});
