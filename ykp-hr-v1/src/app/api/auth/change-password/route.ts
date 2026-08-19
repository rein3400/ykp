import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession, setSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, unauthorized, ok } from '@/lib/http';
import { verifyPassword, hashPassword } from '@/lib/password';
import { z } from 'zod';

const schema = z
  .object({
    current_password: z.string().min(1),
    new_password: z.string().min(6)
  })
  .refine((d) => d.current_password !== d.new_password, {
    message: 'Password baru harus berbeda dari password lama',
    path: ['new_password']
  });

export const POST = handler(async (req) => {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const found = await findRow(TABS.users, 'user_id', session.userId);
  if (!found) return unauthorized('Akun tidak ditemukan');

  const verdict = await verifyPassword(parsed.data.current_password, found.row.password_hash ?? '');
  if (!verdict.ok) return badRequest('Password lama salah');

  const newHash = await hashPassword(parsed.data.new_password);
  await updateRow(TABS.users, found.rowNumber, {
    ...found.row,
    password_hash: newHash,
    must_change_password: 'false'
  });

  // Refresh session so the forced-change flag is cleared.
  await setSession({
    userId: session.userId,
    username: session.username,
    role: session.role,
    brandId: session.brandId,
    outletId: session.outletId,
    mustChangePassword: false
  });

  await logAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'update',
    entity: 'user',
    entityId: session.userId,
    afterValue: JSON.stringify({ password_changed: true })
  });

  return ok({ changed: true });
});
