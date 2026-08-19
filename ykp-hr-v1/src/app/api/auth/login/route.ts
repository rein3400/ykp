import { findRow, updateRow, TABS } from '@/db/sheets';
import { setSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { handler, badRequest, unauthorized, ok } from '@/lib/http';
import { rateLimit, clientKey } from '@/lib/ratelimit';
import { verifyPassword, hashPassword } from '@/lib/password';
import { z } from 'zod';

const schema = z.object({ username: z.string().min(1), password: z.string().min(1) });

export const POST = handler(async (req) => {
  const key = clientKey(req);
  const limit = rateLimit(`login:${key}`, 10, 60_000);
  if (!limit.ok) return unauthorized('Terlalu banyak percobaan, coba lagi nanti');

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const found = await findRow(TABS.users, 'username', parsed.data.username);
  if (!found) return unauthorized('Username/password salah');
  if (found.row.active_status !== 'active') return unauthorized('Akun non-aktif');
  const verdict = await verifyPassword(parsed.data.password, found.row.password_hash ?? '');
  if (!verdict.ok) return unauthorized('Username/password salah');

  // Legacy sha256 hash matched → transparently migrate to bcrypt.
  if (verdict.needsRehash) {
    const newHash = await hashPassword(parsed.data.password);
    await updateRow(TABS.users, found.rowNumber, {
      ...found.row,
      password_hash: newHash
    }).catch(() => null);
  }

  const mustChangePassword = found.row.must_change_password === 'true';

  // employee_id is optional (column added for EMPLOYEE self-only RBAC).
  // Prefer explicit column; fall back to U-EMP-N → Nth employee mapping
  // for rows seeded before the column existed.
  let employeeId = (found.row.employee_id || '').trim() || undefined;
  if (!employeeId && /^U-EMP-(\d+)$/i.test(found.row.user_id)) {
    // Soft-link: U-EMP-1 → first employee, etc. Prefer explicit column when present.
    try {
      const { readTab, TABS } = await import('@/db/sheets');
      const emps = await readTab<{ employee_id: string }>(TABS.employees);
      const idx = Number(found.row.user_id.replace(/^U-EMP-/i, '')) - 1;
      if (idx >= 0 && emps[idx]?.employee_id) employeeId = emps[idx].employee_id;
    } catch {
      // ignore — leave employeeId undefined
    }
  }

  await setSession({
    userId: found.row.user_id,
    username: found.row.username,
    role: found.row.role,
    brandId: found.row.brand_id || undefined,
    outletId: found.row.outlet_id || undefined,
    mustChangePassword,
    employeeId
  });
  await logAudit({
    actorUserId: found.row.user_id,
    actorRole: found.row.role,
    action: 'login',
    entity: 'session',
    entityId: found.row.user_id
  });
  return ok({
    userId: found.row.user_id,
    role: found.row.role,
    mustChangePassword,
    employeeId: employeeId ?? null,
    brandId: found.row.brand_id || null,
    outletId: found.row.outlet_id || null
  });
});
