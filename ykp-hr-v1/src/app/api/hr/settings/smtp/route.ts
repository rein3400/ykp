/**
 * SMTP settings — Owner/HR Admin kelola email pengirim slip gaji dari UI.
 * GET  /api/hr/settings/smtp      → config masked + configured flag
 * PUT  {host,port,user,pass?,secure,from_name} → save (pass kosong = keep existing)
 */
import { getSession } from '@/lib/session';
import { getSmtpConfigMasked, getSmtpConfig, saveSmtpConfig } from '@/lib/app-settings';
import { logAudit } from '@/lib/audit';
import { handler, ok, unauthorized, forbidden, badRequest } from '@/lib/http';
import { can, Role } from '@/lib/rbac';
import { z } from 'zod';

const saveSchema = z.object({
  smtp_host: z.string().min(3).max(200),
  smtp_port: z.string().regex(/^\d{1,5}$/).optional(),
  smtp_user: z.string().email('smtp_user harus email valid'),
  smtp_pass: z.string().max(200).optional(),
  smtp_secure: z.enum(['true', 'false']).optional(),
  smtp_from_name: z.string().min(2).max(80).optional()
});

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'update', 'master')) return forbidden();
  return ok(await getSmtpConfigMasked());
});

export const PUT = handler(async (req) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'update', 'master')) return forbidden();

  const body = await req.json();
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const current = await getSmtpConfig();
  const d = parsed.data;
  await saveSmtpConfig(
    {
      smtp_host: d.smtp_host,
      smtp_port: d.smtp_port ?? '587',
      smtp_user: d.smtp_user,
      smtp_pass: d.smtp_pass && d.smtp_pass.trim() ? d.smtp_pass.trim() : current.pass,
      smtp_secure: d.smtp_secure ?? 'false',
      smtp_from_name: d.smtp_from_name ?? 'YKP HR'
    },
    s.userId
  );

  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'update',
    entity: 'smtp_config',
    entityId: d.smtp_user,
    beforeValue: JSON.stringify({ smtp_user: current.user, host: current.host }),
    afterValue: JSON.stringify({ smtp_user: d.smtp_user, host: d.smtp_host })
  }).catch(() => null);

  return ok(await getSmtpConfigMasked());
});