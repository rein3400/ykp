/**
 * Signed session cookie (HS256 JWS). maxAge 24h, sameSite strict, httpOnly, secure in prod.
 * Cookie name: ykp_warehouse_session.
 */
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';
import { readTab, TABS } from '@/db/sheets';

const ALG = 'HS256';
const HEADER = Buffer.from(JSON.stringify({ alg: ALG, typ: 'JWT' })).toString('base64url');
const COOKIE_NAME = 'ykp_warehouse_session';

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (>=32 chars)');
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: object): string {
  const body = b64url(JSON.stringify(payload));
  const data = `${HEADER}.${body}`;
  const sig = createHmac('sha256', secret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verify(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, b, s] = parts;
  const data = `${h}.${b}`;
  const expected = createHmac('sha256', secret()).update(data).digest('base64url');
  const a = Buffer.from(s);
  const e = Buffer.from(expected);
  if (a.length !== e.length || !timingSafeEqual(a, e)) return null;
  try {
    return JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export interface SessionUser {
  userId: string;
  username: string;
  role: string;
  brandId?: string;
  outletId?: string;
}

export async function setSession(user: SessionUser): Promise<void> {
  const store = await cookies();
  const now = Math.floor(Date.now() / 1000);
  const token = sign({ ...user, iat: now, exp: now + 24 * 3600 });
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && (process.env.HTTPS === "true" || process.env.FORCE_SECURE_COOKIE === "true"),
    path: '/',
    maxAge: 24 * 3600
  });
}

/**
 * Legacy HR/finance accounts are seeded with role "employee", which is not a
 * warehouse role. Treat them as staff so their pages resolve instead of
 * falling through the RBAC matrix and returning nothing.
 */
export function normalizeRole(role?: string): string {
  const value = (role ?? '').toLowerCase();
  return value === 'employee' ? 'staff' : value;
}

/**
 * Merge the cookie claims with the current user record. The record wins so a
 * changed outlet/brand or a deactivated account takes effect without waiting
 * for the 24h cookie to expire; hub SSO sessions have no record and keep the
 * token claims.
 */
export function mergeSession(
  payload: Record<string, unknown>,
  user: Record<string, string> | null
): SessionUser | null {
  if (user && (user.active_status || 'active') !== 'active') return null;
  return {
    userId: (user?.user_id || payload.userId) as string,
    username: (user?.username || payload.username) as string,
    role: normalizeRole((user?.role || payload.role) as string),
    brandId: (user ? user.brand_id || undefined : (payload.brandId as string | undefined)),
    outletId: (user ? user.outlet_id || undefined : (payload.outletId as string | undefined))
  };
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;
  const exp = payload.exp as number | undefined;
  if (exp && exp < Math.floor(Date.now() / 1000)) return null;
  const userId = payload.userId as string;
  if (!userId || userId === 'hub-sso') return mergeSession(payload, null);
  const users = await readTab<Record<string, string>>(TABS.users).catch(() => []);
  const record = users.find((row) => row.user_id === userId) ?? null;
  return mergeSession(payload, record);
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export const SESSION_COOKIE = COOKIE_NAME;