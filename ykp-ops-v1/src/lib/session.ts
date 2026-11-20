/**
 * Signed session cookie (HS256 JWS). Cookie name: ykp_ops_session.
 */
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';
import { readTab, TABS } from '@/db/sheets';

const ALG = 'HS256';
const HEADER = Buffer.from(JSON.stringify({ alg: ALG, typ: 'JWT' })).toString('base64url');

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
  // SameSite=None + Secure is required for the Hub iframe preview: the hub
  // (different origin) embeds Ops in an iframe, and a Strict/Lax cookie is
  // not sent on that cross-site subresource request, so the user would hit
  // /login inside the iframe. None+Secure allows the iframe session while
  // keeping the cookie HTTPS-only + httpOnly. Top-level SSO navigation also
  // works (cookie set on a first-party redirect).
  store.set('ykp_ops_session', token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.HTTPS === "true" || process.env.FORCE_SECURE_COOKIE === "true",
    path: '/',
    maxAge: 24 * 3600,
  });
}

/** super_admin is a superuser alias; unknown roles stay as-is and are denied by RBAC. */
export function normalizeRole(role?: string): string {
  const value = (role ?? '').toLowerCase();
  return value === 'super_admin' ? 'owner' : value;
}

/**
 * The user record wins over cookie claims so outlet/brand changes and
 * deactivations apply without waiting for the 24h cookie to expire.
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
    brandId: user ? user.brand_id || undefined : (payload.brandId as string | undefined),
    outletId: user ? user.outlet_id || undefined : (payload.outletId as string | undefined),
  };
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get('ykp_ops_session')?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;
  const exp = payload.exp as number | undefined;
  if (exp && exp < Math.floor(Date.now() / 1000)) return null;
  const userId = payload.userId as string;
  const users = userId ? await readTab<Record<string, string>>(TABS.users).catch(() => []) : [];
  const record = users.find((row) => row.user_id === userId) ?? null;
  return mergeSession(payload, record);
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete('ykp_ops_session');
}
