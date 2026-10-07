import { updateRow, readTab, TABS, findRow } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, unauthorized, forbidden, conflict, ok, notFound } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';
import { z } from 'zod';
import { leaveDecisionReason, formatTelegramLeave, linkedTelegramChatId } from '@/lib/leave-decision';
import { sendTelegram } from '@/lib/telegram';

const schema = z.object({ leave_id: z.string().min(1), decision: z.enum(['APPROVE', 'REJECT']), reason: z.string().default('') });

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'approve', 'leave')) return forbidden();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  let reason: string;
  try {
    reason = leaveDecisionReason(parsed.data.decision, parsed.data.reason);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Alasan tidak valid');
  }

  const found = await findRow(TABS.leaves, 'leave_id', parsed.data.leave_id);
  if (!found) return notFound('Leave not found');
  if (found.row.approval_status !== 'PENDING') return conflict('Leave already decided');

  const employee = await findRow(TABS.employees, 'employee_id', found.row.employee_id);
  if (!employee) return notFound('Employee not found');
  if (session.outletId && employee.row.outlet_id !== session.outletId) return forbidden();
  if (session.brandId && employee.row.brand_id !== session.brandId) return forbidden();

  const updated = {
    ...found.row,
    approval_status: parsed.data.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    approved_by: session.userId,
    approved_at: nowTimestampWib(),
    rejection_reason: reason
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
  let notification: { status: string; sent: number; failed: number } = { status: 'UNLINKED', sent: 0, failed: 0 };
  try {
    const users = await readTab<Record<string, string>>(TABS.users);
    const recipients = new Set(users.filter((user) => user.employee_id === found.row.employee_id && ['active', '1'].includes((user.active_status ?? '').trim().toLowerCase())).map((user) => linkedTelegramChatId(user.telegram_id)).filter((chatId): chatId is string => chatId !== null));
    for (const recipient of recipients) {
      const delivery = await sendTelegram({ sourceModule: 'HR', sourceReferenceId: parsed.data.leave_id, messageType: 'LEAVE_DECISION', recipient, text: `Keputusan pengajuan cuti\n${formatTelegramLeave(updated)}` });
      notification = { status: delivery.status, sent: notification.sent + delivery.sent, failed: notification.failed + delivery.failed };
    }
  } catch (error) {
    notification = { status: 'FAILED', sent: 0, failed: 1 };
    console.error('[leave:notification]', error instanceof Error ? error.name : 'Delivery error');
  }
  return ok({ ...updated, notification });
});
