import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { findRow, TABS } from '@/db/sheets';
import { setSession } from '@/lib/session';
import { ok, unauthorized, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';

export const POST = handler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = (body.username ?? '').trim();
  const password = body.password ?? '';
  if (!username || !password) return unauthorized('username/password required');

  const userRow = await findRow(TABS.users, 'username', username);
  if (!userRow) return unauthorized('Invalid credentials');
  const hash = createHash('sha256').update(password).digest('hex');
  if (userRow.row.password_hash !== hash) return unauthorized('Invalid credentials');
  if (userRow.row.active_status !== 'active') return unauthorized('User inactive');

  await setSession({
    userId: userRow.row.user_id,
    username: userRow.row.username,
    role: (userRow.row.role ?? '').toLowerCase(),
    brandId: userRow.row.brand_id || undefined,
    outletId: userRow.row.outlet_id || undefined
  });

  await logAudit({
    module: 'auth',
    action: 'login',
    recordType: 'user',
    recordId: userRow.row.user_id,
    userId: userRow.row.user_id,
    ipAddress: req.headers.get('x-forwarded-for') ?? ''
  }).catch(() => null);

  return ok({
    user_id: userRow.row.user_id,
    username: userRow.row.username,
    role: (userRow.row.role ?? '').toLowerCase(),
    brand_id: userRow.row.brand_id,
    outlet_id: userRow.row.outlet_id,
    login_at: nowTimestampWib()
  });
});
