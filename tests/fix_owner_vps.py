import paramiko
import base64

SESSION_TS = """/**
 * Signed session cookie (HS256 JWS) — same convention as the sibling apps.
 * Cookie: ykp_owner_session, 24h, httpOnly, sameSite lax for SSO redirect, secure in prod when HTTPS.
 */
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

const ALG = 'HS256';
const HEADER = Buffer.from(JSON.stringify({ alg: ALG, typ: 'JWT' })).toString('base64url');
export const SESSION_COOKIE = 'ykp_owner_session';

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
}

export async function setSession(user: SessionUser): Promise<void> {
  const store = await cookies();
  const now = Math.floor(Date.now() / 1000);
  const token = sign({ ...user, iat: now, exp: now + 24 * 3600 });
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && (process.env.HTTPS === 'true' || process.env.FORCE_SECURE_COOKIE === 'true'),
    path: '/',
    maxAge: 24 * 3600
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;
  const exp = payload.exp as number | undefined;
  if (exp && exp < Math.floor(Date.now() / 1000)) return null;
  return {
    userId: payload.userId as string,
    username: payload.username as string,
    role: (payload.role as string)?.toLowerCase() as string
  };
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
"""

LOGIN_ROUTE_TS = """/**
 * GET & POST /api/auth/login
 * GET  = Hub portal SSO bridge (opens /api/auth/login?role=SUPER_ADMIN&token=<secret>&redirect=/)
 * POST = Manual form login proxying credentials to HR or falling back to mock
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { setSession } from '@/lib/session';
import { canView } from '@/lib/rbac';
import { isMockForced } from '@/lib/aggregate';
import { rateLimit, clientKey } from '@/lib/ratelimit';

const schema = z.object({ username: z.string().min(1), password: z.string().min(1) });

const MOCK_USER = { userId: 'USR-MOCK-OWNER', username: 'owner', role: 'owner' };
const MOCK_PASSWORD = 'owner123';

function fail(message: string, status = 401): NextResponse {
  return NextResponse.json({ error: { code: 'unauthorized', message } }, { status });
}

function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/owner';
  return target;
}

function publicOrigin(req: NextRequest): string {
  const xfHost = req.headers.get('x-forwarded-host');
  const xfProto = req.headers.get('x-forwarded-proto');
  if (xfHost) return `${xfProto ?? 'http'}://${xfHost}`;
  return req.nextUrl.origin;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const roleParam = (req.nextUrl.searchParams.get('role') ?? 'OWNER').toLowerCase();
  const token = req.nextUrl.searchParams.get('token');
  const ssoSecret = process.env.ERP_SSO_SECRET;

  if (ssoSecret && token && token !== ssoSecret) {
    return fail('Token SSO tidak valid', 403);
  }

  const role = ['owner', 'super_admin'].includes(roleParam) ? 'owner' : 'viewer';
  const redirect = safeRedirect(req.nextUrl.searchParams.get('redirect'));

  await setSession({
    userId: 'hub-sso-owner',
    username: 'owner',
    role,
  });

  return NextResponse.redirect(new URL(redirect, publicOrigin(req)), 302);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const key = clientKey(req);
  const rl = rateLimit(`login:${key}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Terlalu banyak percobaan. Coba lagi nanti.' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Username & password wajib diisi' } },
      { status: 400 }
    );
  }
  const { username, password } = parsed.data;
  const mockOk = username === MOCK_USER.username && password === MOCK_PASSWORD;

  if (isMockForced()) {
    if (!mockOk) return fail('Username/password salah (mode MOCK: owner/owner123)');
    await setSession(MOCK_USER);
    return NextResponse.json({ data: { ...MOCK_USER, mock: true } });
  }

  // Live path: proxy to HR as identity provider (4s budget, like aggregation).
  const hrUrl = (process.env.YKP_HR_URL ?? 'http://localhost:3002').replace(/\\/$/, '');
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(`${hrUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: ctrl.signal,
      cache: 'no-store'
    });
    clearTimeout(timer);
    if (r.ok) {
      const j = (await r.json()) as { data?: { userId?: string; role?: string } };
      const role = (j.data?.role ?? '').toLowerCase();
      if (!canView(role)) return fail('Role tidak diizinkan di dashboard owner', 403);
      await setSession({ userId: j.data?.userId ?? username, username, role });
      return NextResponse.json({ data: { username, role, mock: false } });
    }
    if (r.status < 500) return fail('Username/password salah');
    // HR 5xx → fall through to mock fallback
  } catch {
    // HR unreachable → fall through to mock fallback
  }

  // HR down: only the local mock owner can enter (the banner makes it obvious).
  if (!mockOk) {
    return fail('HR auth tidak bisa dihubungi — hanya akun mock (owner/owner123) yang bisa login');
  }
  await setSession(MOCK_USER);
  return NextResponse.json({ data: { ...MOCK_USER, mock: true } });
}
"""

def upload_file(sftp, remote_path, content):
    with sftp.file(remote_path, 'w') as f:
        f.write(content)
    print(f"Uploaded {remote_path}")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')
sftp = ssh.open_sftp()

upload_file(sftp, '/home/dev/ykp/ykp-owner-v1/src/lib/session.ts', SESSION_TS)
upload_file(sftp, '/home/dev/ykp/ykp-owner-v1/src/app/api/auth/login/route.ts', LOGIN_ROUTE_TS)

sftp.close()

stdin, stdout, stderr = ssh.exec_command('export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:$PATH; cd /home/dev/ykp/ykp-owner-v1 && npm run build')
print("BUILD STDOUT:\n", stdout.read().decode())
print("BUILD STDERR:\n", stderr.read().decode())

stdin, stdout, stderr = ssh.exec_command('export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:$PATH; pm2 restart ykp-owner-v1')
print("PM2 RESTART:\n", stdout.read().decode())

ssh.close()
