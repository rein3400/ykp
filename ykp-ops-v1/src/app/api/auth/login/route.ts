/**
 * Auth routes for Operational V1.
 */
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { setSession } from '@/lib/session';
import { readTab, TABS } from '@/db/sheets';
import { ok, handler, unauthorized, badRequest } from '@/lib/http';

function hashPassword(pw: string): string {
  return createHash('sha256').update(pw).digest('hex');
}

export const POST = handler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const { username, password } = body;
  if (!username || !password) return badRequest('username and password required');
  const users = await readTab(TABS.users);
  const user = users.find((u) => u.username === username && u.active_status === 'active');
  if (!user || user.password_hash !== hashPassword(password)) {
    return unauthorized('Invalid username or password');
  }
  await setSession({
    userId: user.user_id,
    username: user.username,
    role: user.role,
    brandId: user.brand_id || undefined,
    outletId: user.outlet_id || undefined,
  });
  return ok({ userId: user.user_id, username: user.username, role: user.role });
});

export const GET = handler(async () => {
  return ok({ ok: true });
});
