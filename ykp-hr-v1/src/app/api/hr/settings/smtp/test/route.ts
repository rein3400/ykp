/**
 * POST /api/hr/settings/smtp/test  { to }
 * Verifies SMTP connection + sends a test email. Owner verification path
 * for the SMTP settings UI — non-technical users must be able to confirm
 * their App Password works without SSH.
 */
import { getSession } from '@/lib/session';
import { getSmtpConfig } from '@/lib/app-settings';
import { logAudit } from '@/lib/audit';
import { handler, ok, unauthorized, forbidden, badRequest } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { z } from 'zod';

const schema = z.object({ to: z.string().email('to harus email valid') });

export const POST = handler(async (req) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'update', 'master')) return forbidden();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const cfg = await getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    return badRequest('SMTP belum lengkap. Isi host, user, dan password terlebih dahulu.');
  }

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: Number(cfg.port || 587),
    secure: cfg.secure === 'true',
    auth: { user: cfg.user, pass: cfg.pass }
  });

  try {
    await transporter.verify();
    const info = await transporter.sendMail({
      from: `${cfg.from_name} <${cfg.user}>`,
      to: parsed.data.to,
      subject: 'Tes Koneksi Email — YKP HR',
      text: 'Jika email ini masuk, setting SMTP sudah benar. Slip gaji akan terkirim otomatis dari email ini.',
      html: '<p>Jika email ini masuk, <b>setting SMTP sudah benar</b>. Slip gaji akan terkirim otomatis dari email ini.</p>'
    });
    await logAudit({
      actorUserId: s.userId,
      actorRole: s.role,
      action: 'update',
      entity: 'smtp_config',
      entityId: cfg.user,
      afterValue: JSON.stringify({ test_sent: true, to: parsed.data.to, messageId: info.messageId })
    }).catch(() => null);
    return ok({ sent: true, mocked: false, to: parsed.data.to, messageId: info.messageId });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logAudit({
      actorUserId: s.userId,
      actorRole: s.role,
      action: 'update',
      entity: 'smtp_config',
      entityId: cfg.user,
      afterValue: JSON.stringify({ test_sent: false, error: message })
    }).catch(() => null);
    return badRequest(`SMTP test gagal: ${message}`);
  }
});