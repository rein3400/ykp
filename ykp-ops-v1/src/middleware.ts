import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'ykp_ops_session';
const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout'];

const TOKEN_BUCKET = new Map<string, { tokens: number; ts: number }>();
const LIMIT_DEFAULT = 120;
const WINDOW_MS = 60_000;

// Edge-compatible HMAC-SHA256 verify using Web Crypto API.
async function verify(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    if (secret.length < 32) return false;
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, data);
    const expected = new Uint8Array(sig);
    const provided = base64UrlDecode(parts[2]);
    if (provided.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ provided[i];
    return diff === 0;
  } catch {
    return false;
  }
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function allowRequest(ip: string, limit: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = TOKEN_BUCKET.get(ip);
  if (!entry) {
    TOKEN_BUCKET.set(ip, { tokens: limit - 1, ts: now });
    return { allowed: true, remaining: limit - 1 };
  }
  const elapsed = now - entry.ts;
  if (elapsed > WINDOW_MS) {
    TOKEN_BUCKET.set(ip, { tokens: limit - 1, ts: now });
    return { allowed: true, remaining: limit - 1 };
  }
  if (entry.tokens <= 0) return { allowed: false, remaining: 0 };
  entry.tokens -= 1;
  return { allowed: true, remaining: entry.tokens };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return res;
  }
  // Public Hermez-facing summary read endpoint
  if (pathname.startsWith('/api/ops/summary') && req.method === 'GET') {
    return res;
  }

  const ip = clientIp(req);
  const { allowed, remaining } = allowRequest(ip, LIMIT_DEFAULT);
  if (!allowed) {
    return new NextResponse(
      JSON.stringify({ error: { code: 'rate_limited', message: 'Too many requests' } }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(LIMIT_DEFAULT),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + 60),
        },
      },
    );
  }
  res.headers.set('X-RateLimit-Limit', String(LIMIT_DEFAULT));
  res.headers.set('X-RateLimit-Remaining', String(remaining));
  res.headers.set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + 60));

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET ?? '';
  if (!cookie || !(await verify(cookie, secret))) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: { code: 'unauthorized', message: 'Unauthorized' } }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
