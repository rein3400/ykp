/**
 * Unlock a LOCKED payroll row. Owner/Super Admin only.
 * Sets locked_status = 'UNLOCKED', records reason + approver, writes audit log.
 */
import { updateRow, TABS, findRow } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, unauthorized, forbidden, conflict, ok, notFound } from '@/lib/http';
import { nowTimestampWib } from '@/lib/format';
import { z } from 'zod';

const schema = z.object({
  payroll_id: z.string().min(1),
  reason: z.string().min(1, 'Unlock reason is required')
});

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();

  const role = session.role;
  if (role !== 'owner' && role !== 'super_admin') {
    return forbidden('Only owner or super_admin can unlock payroll');
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const found = await findRow(TABS.payroll, 'payroll_id', parsed.data.payroll_id);
  if (!found) return notFound('Payroll not found');
  if (found.row.locked_status !== 'LOCKED') {
    return conflict('Payroll is not locked');
  }

  const updated = {
    ...found.row,
    locked_status: 'UNLOCKED',
    unlock_reason: parsed.data.reason,
    unlock_approved_by: session.userId,
    updated_at: nowTimestampWib()
  };
  await updateRow(TABS.payroll, found.rowNumber, updated);
  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'unlock',
    entity: 'payroll',
    entityId: parsed.data.payroll_id,
    reason: parsed.data.reason
  });
  return ok(updated);
});
