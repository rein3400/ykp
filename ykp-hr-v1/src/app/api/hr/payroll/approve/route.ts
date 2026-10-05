/**
 * Approve a payroll row (legacy path). PENDING -> APPROVED, sets approved_by + updated_at.
 * Owner/super_admin only per RBAC. Happy path no longer needs this call: generate
 * auto-approves (payroll-auto-approve) — kept idempotent for already-APPROVED rows.
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
  decision: z.enum(['APPROVE', 'REJECT', 'NEEDS_REVISION']),
  reason: z.string().max(500).optional(),
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
  const decision = parsed.data.decision;
  if (decision === 'NEEDS_REVISION') {
    if (!parsed.data.reason?.trim()) return badRequest('Alasan revisi wajib diisi');
    if (!['PENDING', 'APPROVED'].includes(found.row.approval_status)) {
      return conflict(`Payroll is ${found.row.approval_status}, cannot request revision`);
    }
  } else if (decision === 'APPROVE' && found.row.approval_status === 'APPROVED') {
    // Auto-approve: generate sudah menyelesaikan baris dalam state APPROVED
    // (payroll-auto-approve) — approve ulang bersifat idempotent, tanpa write.
    return ok(found.row);
  } else if (found.row.approval_status !== 'PENDING') {
    return conflict(`Payroll is ${found.row.approval_status}, cannot decide`);
  }

  const isApprove = decision === 'APPROVE';
  const isRevision = decision === 'NEEDS_REVISION';
  const now = nowTimestampWib();
  const updated = {
    ...found.row,
    approval_status: isApprove ? 'APPROVED' : isRevision ? 'NEEDS_REVISION' : 'REJECTED',
    payment_status: isApprove ? 'READY_TO_PAY' : found.row.payment_status,
    approved_by: isRevision ? found.row.approved_by : session.userId,
    updated_at: now,
    ...(isApprove
      ? { locked_status: 'LOCKED', locked_at: now, locked_by: session.userId }
      : {}),
    ...(isRevision
      ? {
          needs_revision_reason: parsed.data.reason!.trim(),
          needs_revision_at: now,
          needs_revision_by: session.userId,
          locked_status: 'UNLOCKED',
          locked_at: '',
          locked_by: '',
        }
      : {}),
  };
  await updateRow(TABS.payroll, found.rowNumber, updated);
  const auditAction = isApprove ? 'approve' : isRevision ? 'request_revision' : 'reject';
  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: auditAction,
    entity: 'payroll',
    entityId: parsed.data.payroll_id,
    beforeValue: JSON.stringify(found.row),
    afterValue: JSON.stringify(updated),
    reason: isRevision ? parsed.data.reason!.trim() : undefined,
  });

  if (isApprove) {
    // Payroll yang approved langsung terlihat pada antrean Finance dari shared
    // HR payroll source; tidak diperlukan tombol/notifikasi kedua. Email slip
    // baru dikirim setelah Finance transfer dan HR menjalankan validasi PAID.
    await logAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'finance_queue_ready',
      entity: 'payroll',
      entityId: parsed.data.payroll_id,
      afterValue: 'APPROVED + LOCKED; visible to Finance queue'
    });
  }

  return ok(updated);
});
