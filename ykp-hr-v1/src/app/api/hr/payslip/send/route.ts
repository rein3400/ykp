/**
 * Send a payslip to the employee's email — MOM 1 Sep 2026 Tahap 5.
 *
 * POST /api/hr/payslip/send { payroll_id }
 * HR publishes the slip AFTER Finance marks it PAID. The email carries the
 * same HTML slip as the browser view, inline + as a file attachment
 * (bukti transfer is NOT sent to employees, per MOM).
 *
 * Roles: owner / super_admin / hr_admin (HR publishes slips).
 * Requires SMTP env (SMTP_HOST/USER/PASS); otherwise 503 with a clear
 * message — never crash, never pretend it was sent.
 * Upgrade path: swap the .html attachment for a rendered PDF (puppeteer)
 * without changing this route's contract.
 */
import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, unauthorized, forbidden, conflict, notFound, ok, fail } from '@/lib/http';
import { smtpConfig, sendMail } from '@/lib/smtp';
import { Buffer } from 'node:buffer';
import { z } from 'zod';
import { buildPayslipHtml } from '../[id]/route';

const schema = z.object({ payroll_id: z.string().min(1) });

const PUBLISH_ROLES = ['owner', 'super_admin', 'hr_admin'];

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!PUBLISH_ROLES.includes(session.role)) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest('payroll_id wajib diisi');

  const cfg = smtpConfig();
  if (!cfg) {
    return fail(
      'smtp_not_configured',
      'SMTP belum dikonfigurasi (SMTP_HOST/SMTP_USER/SMTP_PASS). Minta kredensial 1 email pengirim ke developer.',
      503
    );
  }

  const found = await findRow(TABS.payroll, 'payroll_id', parsed.data.payroll_id);
  if (!found) return notFound('Payroll not found');
  const row = found.row;
  if (row.payment_status !== 'PAID') {
    return conflict(`Slip hanya dikirim setelah PAID, status sekarang: ${row.payment_status || '-'}`);
  }

  const employee = await findRow(TABS.employees, 'employee_id', row.employee_id);
  const email = (employee?.row.email ?? '').trim();
  if (!email) return badRequest(`Karyawan ${row.employee_id} belum punya email di master data`);

  const html = buildPayslipHtml(row.payroll_id, row);
  const filename = `slip-${row.payroll_period}-${row.employee_id}.html`;
  const emailAt = new Date().toISOString();
  try {
    const { messageId } = await sendMail({
      to: email,
      subject: `Slip Gaji ${row.payroll_period} — ${row.employee_name}`,
      html: `<p>Yth. ${row.employee_name},</p><p>Terlampir slip gaji periode ${row.payroll_period}. Dokumen ini bersifat rahasia.</p>`,
      attachments: [{ filename, contentType: 'text/html', content: Buffer.from(html, 'utf8') }]
    });
    const stamped = {
      ...row,
      email_sent_at: emailAt,
      email_sent_to: email,
      email_sent_status: 'SENT'
    };
    const refetch = await findRow(TABS.payroll, 'payroll_id', row.payroll_id);
    if (refetch) await updateRow(TABS.payroll, refetch.rowNumber, stamped);
    await logAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'send_payslip',
      entity: 'payroll',
      entityId: row.payroll_id,
      afterValue: `${email} ${messageId}`
    });
    return ok({ payroll_id: row.payroll_id, email, messageId });
  } catch (e) {
    console.error('[payslip:send]', e instanceof Error ? e.message : e);
    const refetch = await findRow(TABS.payroll, 'payroll_id', row.payroll_id);
    if (refetch) {
      await updateRow(TABS.payroll, refetch.rowNumber, {
        ...refetch.row,
        email_sent_at: emailAt,
        email_sent_to: email,
        email_sent_status: 'FAILED'
      });
    }
    return fail('smtp_send_failed', 'Gagal mengirim email slip (cek config SMTP / koneksi)', 502);
  }
});
