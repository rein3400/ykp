import { NextRequest } from 'next/server';
import { verifyPassword } from '@/lib/password';
import { setSession } from '@/lib/session';
import { readTab, TABS } from '@/db/sheets';
import { ok, handler, unauthorized, badRequest } from '@/lib/http';
import { rateLimit, clientKey } from '@/lib/ratelimit';

export const POST = handler(async (req: NextRequest) => {
  const limit = rateLimit(`login:${clientKey(req)}`, 10, 60_000);
  if (!limit.ok) return unauthorized('Terlalu banyak percobaan, coba lagi nanti');
  const body = await req.json().catch(() => null);
  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string' || !body.username.trim() || !body.password) return badRequest('username and password required');
  const users = await readTab(TABS.users);
  const user = users.find((row) => row.username === body.username.trim() && row.active_status === 'active');
  if (!user || !(await verifyPassword(body.password, user.password_hash ?? ''))) return unauthorized('Invalid username or password');
  await setSession({ userId: user.user_id, username: user.username, role: user.role, brandId: user.brand_id || undefined, outletId: user.outlet_id || undefined });
  return ok({ userId: user.user_id, username: user.username, role: user.role });
});

export const GET = handler(async () => unauthorized('Gunakan formulir login. Login berdasarkan role URL dinonaktifkan.'));
