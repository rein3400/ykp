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
import { createHash, timingSafeEqual } from 'crypto';
import { setSession } from '@/lib/session';
import { readTab, TABS } from '@/db/sheets';
import { ok, handler, unauthorized, badRequest } from '@/lib/http';

function hashPassword(pw: string): string {
  return createHash('sha256').update(pw).digest('hex');
}

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

export const GET = handler(async (req: NextRequest) => {
  // Hub SSO bridge: ?role=<hubRole>&token=<ERP_SSO_SECRET>&redirect=/<path>
  // Token-gated: without a valid shared secret anyone could mint an owner
  // session by hitting this endpoint. Fail closed if ERP_SSO_SECRET is unset
  // OR the token does not match. ERP_SSO_SECRET must equal the hub's
  // NEXT_PUBLIC_ERP_SSO_SECRET (ykp_sso_secret_2024_prod_v1 in production).
  const expected = process.env.ERP_SSO_SECRET ?? '';
  const token = req.nextUrl.searchParams.get('token') ?? '';
  // Constant-time compare on the SSO shared secret (the fail-closed guard
  // below is already in place; this removes the timing side-channel from the
  // previous `token !== expected` check). Buffer lengths must match before
  // timingSafeEqual or it throws, so mismatched lengths short-circuit to 401.
  if (!expected) {
    return unauthorized('Invalid SSO token');
  }
  const a = Buffer.from(token);
  const e = Buffer.from(expected);
  if (a.length !== e.length || !timingSafeEqual(a, e)) {
    return unauthorized('Invalid SSO token');
  }
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
