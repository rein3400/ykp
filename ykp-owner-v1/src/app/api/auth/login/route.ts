/**
 * POST /api/auth/login
 * HR-as-IdP: credentials are proxied to `${YKP_HR_URL}/api/auth/login`;
 * on success we mint our own HS256 cookie (ykp_owner_session).
 * Mock mode (YKP_OWNER_MOCK=true, or HR unreachable): owner/owner123
 * against a local mock user — the UI shows a warning banner.
 */
import { NextResponse } from 'next/server';
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

export async function POST(req: Request): Promise<NextResponse> {
  // Throttle brute-force attempts per client IP (same limit as other modules).
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
  const hrUrl = (process.env.YKP_HR_URL ?? 'http://localhost:3002').replace(/\/$/, '');
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
