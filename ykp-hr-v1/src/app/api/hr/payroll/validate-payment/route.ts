/**
 * Validasi Pembayaran (HR) — MOM 1 Sep 2026 Tahap 5.
 *
 * HR menerima info/bukti transfer dari Finance → klik "Validasi Pembayaran":
 *  - row APPROVED & belum PAID  →  PAID + LOCKED (payment_date, locked_by)
 *  - slip gaji resmi OTOMATIS dikirim ke email karyawan via SMTP
 *  - audit: action `validate_payment` (+ before/after) & `payslip_email:<status>`
 *
 * Roles: pemegang grant mark_paid (owner / super_admin / finance_admin).
 * Bila SMTP belum dikonfigurasi, validasi tetap sukses dan hasil email
 * dilaporkan apa adanya (tidak pernah pura-pura terkirim).
 */
import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, unauthorized, forbidden, conflict, notFound, ok } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { nowTimestampWib, todayWib } from '@/lib/format';
import { getBrandEmail, buildPayslipEmailHtml, sendPayslipEmail } from '@/lib/payslip-email';
import { z } from 'zod';

const schema = z.object({ payroll_id: z.string().min(1) });

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!can(session.role as Role, 'mark_paid', 'payroll')) return forbidden();

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const found = await findRow(TABS.payroll, 'payroll_id', parsed.data.payroll_id);
  if (!found) return notFound('Payroll tidak ditemukan');
  if ((found.row.approval_status ?? '').toUpperCase() !== 'APPROVED') {
    return conflict('Hanya payroll berstatus APPROVED yang dapat divalidasi');
  }
  if ((found.row.payment_status ?? '').toUpperCase() === 'PAID') {
    return conflict('Payroll sudah PAID');
  }

  const now = nowTimestampWib();
  const updated: Record<string, string> = {
    ...found.row,
    payment_status: 'PAID',
    payment_date: todayWib(),
    locked_status: 'LOCKED',
    locked_at: now,
    locked_by: session.userId,
    updated_at: now
  };
  await updateRow(TABS.payroll, found.rowNumber, updated);

  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'validate_payment',
    entity: 'payroll',
    entityId: parsed.data.payroll_id,
    beforeValue: JSON.stringify(found.row),
    afterValue: JSON.stringify(updated)
  });

  // ── Kirim slip resmi ke email karyawan (best-effort, hasil dilaporkan) ──
  let emailResult: { sent: boolean; mocked: boolean; to?: string; from?: string; error?: string } | undefined;
  try {
    const brandConfig = await getBrandEmail(found.row.brand_id);
    const empRow = await findRow(TABS.employees, 'employee_id', found.row.employee_id);
    const employeeEmail = ((empRow?.row.email as string) ?? '').trim();
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
        subject,
        html,
        text
      });
      emailResult = { sent: sent.sent, mocked: sent.mocked, to: employeeEmail, from: brandConfig.email, error: sent.error };
      const emailStatus = sent.sent ? (sent.mocked ? 'MOCKED' : 'SENT') : 'FAILED';
      const withEmail = { ...updated, email_sent_at: now, email_sent_to: employeeEmail, email_sent_status: emailStatus, updated_at: now };
      await updateRow(TABS.payroll, found.rowNumber, withEmail);
      await logAudit({
        actorUserId: session.userId,
        actorRole: session.role,
        action: `payslip_email:${emailStatus}`,
        entity: 'payroll',
        entityId: parsed.data.payroll_id,
        afterValue: JSON.stringify({ 'to': employeeEmail, 'from': brandConfig.email })
      });
      return ok({ payroll: withEmail, email: emailResult });
    }
    return ok({ payroll: updated, email: { sent: false, mocked: false, error: brandConfig ? 'Karyawan tidak punya email' : 'Brand belum punya email pengirim' } });
  } catch (e) {
    return ok({ payroll: updated, email: { sent: false, mocked: false, error: e instanceof Error ? e.message : 'Gagal kirim email' } });
  }
});
