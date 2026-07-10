import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout'];

// Edge-compatible HMAC-SHA256 verify using Web Crypto API.
// `crypto.subtle` is available in both edge runtime and Node.js 20+.
async function verify(token: string, secret: string): Promise<boolean> {
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
  // Decode base64url signature from token
  const provided = base64UrlDecode(parts[2]);
  if (provided.length !== expected.length) return false;
  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ provided[i];
  return diff === 0;
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }
  // Allow static + Hermez-facing summary read endpoint without session
  if (pathname.startsWith('/api/hr/summary') && req.method === 'GET') {
    return NextResponse.next();
  }
  const cookie = req.cookies.get('ykp_hr_session')?.value;
  const secret = process.env.SESSION_SECRET ?? '';
  if (!cookie || !(await verify(cookie, secret))) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: { code: 'unauthorized', message: 'Unauthorized' } }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};