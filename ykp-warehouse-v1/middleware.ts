import { NextResponse, type NextRequest } from 'next/server';

// Keep cookie name inline — do NOT import from session.ts (Node crypto breaks Edge Runtime).
const SESSION_COOKIE = 'ykp_warehouse_session';
const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout', '/api/warehouse/notify/daily-brief'];
// Public read endpoints for Hermez integration
const PUBLIC_GET_PREFIXES = [
  '/api/warehouse/summary',
  '/api/warehouse/alerts',
  '/api/warehouse/actions',
  '/api/warehouse/purchase-recommendation',
  '/api/warehouse/audit',
  '/api/warehouse/attachments',
  '/api/warehouse/recipe-costs'
];

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
  const provided = base64UrlDecode(parts[2]);
  if (provided.length !== expected.length) return false;
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
  // Public read endpoints for Hermez (GET only)
  if (req.method === 'GET' && PUBLIC_GET_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }
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
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};