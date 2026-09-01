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
import { getBrandEmail, buildPayslipEmailHtml, sendPayslipEmail } from '@/lib/payslip-email';

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

  let emailResult: { sent: boolean; mocked: boolean; to?: string; from?: string; error?: string } | undefined;
  if (parsed.data.decision === 'APPROVE') {
    try {
      const brandConfig = await getBrandEmail(found.row.brand_id);
      const empRow = await findRow(TABS.employees, 'employee_id', found.row.employee_id);
      const employeeEmail = (empRow?.row.email as string ?? '').trim();
      if (employeeEmail && brandConfig) {
        const { subject, html, text } = buildPayslipEmailHtml({
          employeeName: found.row.employee_name,
          payrollPeriod: found.row.payroll_period,
          brandName: brandConfig.brandName,
          brandId: found.row.brand_id,
          payroll: updated
        });
        const sent = await sendPayslipEmail({
          to: employeeEmail,
          fromEmail: brandConfig.email,
          fromName: brandConfig.brandName,
          subject, html, text
        });
        emailResult = { sent: sent.sent, mocked: sent.mocked, to: employeeEmail, from: brandConfig.email, error: sent.error };
        const emailStatus = sent.sent ? (sent.mocked ? 'MOCKED' : 'SENT') : 'FAILED';
        const emailAt = nowTimestampWib();
        const payrollWithEmail = {
          ...updated,
          email_sent_at: emailAt,
          email_sent_to: employeeEmail,
          email_sent_status: emailStatus,
          updated_at: emailAt
        };
        await updateRow(TABS.payroll, found.rowNumber, payrollWithEmail);
        await logAudit({
          actorUserId: session.userId,
          actorRole: session.role,
          action: `payslip_email:${emailStatus}`,
          entity: 'payroll',
          entityId: parsed.data.payroll_id
        });
        return ok({ ...payrollWithEmail, email: emailResult });
      }
    } catch {
      // best-effort: approve tetap sukses walau email gagal
    }
  }

  return ok({ ...updated, email: emailResult });
});
