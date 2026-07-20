/**
 * Auth routes for Operational V1.
 *
 * GET = Hub portal SSO bridge. Hub opens
 *   /api/auth/login?role=<hubRole>&redirect=/<path>
 * We mint the ykp_ops_session cookie (same shape as POST) and 302-redirect
 * to `redirect` (default "/ops"). `redirect` is constrained to same-origin
 * absolute paths to avoid open-redirect abuse. The hub role maps onto an
 * Operational role (owner/manager -> owner, else staff) since the ops RBAC
 * matrix is keyed on lowercase roles.
 */
import { NextRequest, NextResponse } from 'next/server';
import { setSession } from '@/lib/session';
import { readTab, TABS } from '@/db/sheets';
import { ok, handler, unauthorized, badRequest } from '@/lib/http';
import { verifyPassword, hashPassword } from '@/lib/password';
import { rateLimit, clientKey } from '@/lib/ratelimit';

function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/ops';
  return target;
}

/** Public origin from forwarded headers (Vercel/proxy sets x-forwarded-*). */
function publicOrigin(req: NextRequest): string {
  const xfHost = req.headers.get('x-forwarded-host');
  const xfProto = req.headers.get('x-forwarded-proto');
  if (xfHost) return `${xfProto ?? 'https'}://${xfHost}`;
  return req.nextUrl.origin;
}

export const POST = handler(async (req: NextRequest) => {
  const key = clientKey(req);
  const limit = rateLimit(`login:${key}`, 10, 60_000);
  if (!limit.ok) return unauthorized('Terlalu banyak percobaan, coba lagi nanti');

  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const { username, password } = body;
  if (!username || !password) return badRequest('username and password required');
  const users = await readTab(TABS.users);
  const user = users.find((u) => u.username === username && u.active_status === 'active');
  if (!user) return unauthorized('Invalid username or password');
  const verdict = await verifyPassword(password, user.password_hash ?? '');
  if (!verdict.ok) return unauthorized('Invalid username or password');

  if (verdict.needsRehash) {
    const newHash = await hashPassword(password);
    // Ops sheets.ts does not expose updateRow by column key easily; skip rehash in sheets.
    void newHash;
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

export const GET = handler(async (req: NextRequest) => {
  const roleParam = (req.nextUrl.searchParams.get('role') ?? 'OWNER').toLowerCase();
  // Map hub role onto an Operational role. owner/super_admin/manager -> owner
  // (full access); anything else -> staff.
  const role = ['owner', 'super_admin', 'manager', 'brand_manager'].includes(roleParam)
    ? 'owner'
    : 'staff';
  const redirect = safeRedirect(req.nextUrl.searchParams.get('redirect'));
  await setSession({
    userId: 'hub-sso',
    username: 'hub',
    role,
  });
  return NextResponse.redirect(new URL(redirect, publicOrigin(req)), 302);
});
