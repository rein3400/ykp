import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware — lightweight gate only.
 *
 * Full HMAC verification lives in Node `getSession()` (session.ts).
 * Edge previously re-implemented HMAC and could reject valid cookies when
 * SESSION_SECRET was missing/mismatched at the Edge runtime, causing a
 * permanent login loop (login 200 + Set-Cookie, then /ops → 401/redirect).
 *
 * Here we only require a well-formed session cookie (3 JWT segments).
 * Server components and API routes still call getSession() for real auth.
 */
const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout', '/api/ops/telegram/link/consume'];

/** Origins allowed to embed Ops in an iframe (the Hub portal). */
const HUB_ORIGINS = (process.env.HUB_ORIGINS ?? 'https://ykp-hub-production.up.railway.app')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function hasSessionCookie(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

function withCsp(res: NextResponse): NextResponse {
  const ancestors = HUB_ORIGINS.length ? `frame-ancestors 'self' ${HUB_ORIGINS.join(' ')}` : "frame-ancestors 'none'";
  res.headers.set('Content-Security-Policy', `${ancestors}; frame-src 'self'`);
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return withCsp(NextResponse.next());
  }
  // Hermez-facing public summary
  if (pathname.startsWith('/api/ops/summary') && req.method === 'GET') {
    return withCsp(NextResponse.next());
  }

  const cookie = req.cookies.get('ykp_ops_session')?.value;
  if (!hasSessionCookie(cookie)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Unauthorized' } },
        { status: 401 }
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return withCsp(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
