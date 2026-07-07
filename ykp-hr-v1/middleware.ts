import { NextResponse, type NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout'];

function verify(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const secret = process.env.SESSION_SECRET ?? '';
  if (secret.length < 32) return false;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = createHmac('sha256', secret).update(data).digest('base64url');
  const a = Buffer.from(parts[2]);
  const e = Buffer.from(expected);
  return a.length === e.length && timingSafeEqual(a, e);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }
  // Allow static + Hermez-facing summary read endpoint without session
  if (pathname.startsWith('/api/hr/summary') && req.method === 'GET') {
    return NextResponse.next();
  }
  const cookie = req.cookies.get('ykp_hr_session')?.value;
  if (!cookie || !verify(cookie)) {
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