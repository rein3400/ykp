/**
 * JSON response helpers. 5xx never leaks stack/pg messages to client.
 */
import { NextResponse } from 'next/server';

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function list<T>(items: T[], total?: number): NextResponse {
  return NextResponse.json({ data: { items, total_items: total ?? items.length } });
}

export function fail(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function unauthorized(message = 'Unauthorized'): NextResponse {
  return fail('unauthorized', message, 401);
}

export function forbidden(message = 'Forbidden'): NextResponse {
  return fail('forbidden', message, 403);
}

export function badRequest(message: string): NextResponse {
  return fail('bad_request', message, 400);
}

export function missingRef(message: string): NextResponse {
  return fail('missing_ref', message, 400);
}

export function conflict(message: string): NextResponse {
  return fail('conflict', message, 409);
}

export function notFound(message = 'Not found'): NextResponse {
  return fail('not_found', message, 404);
}

export function serverError(logId?: string): NextResponse {
  return fail('internal_error', `Internal server error${logId ? ` (ref ${logId})` : ''}`, 500);
}

/** Wrap an async route handler; catch all errors, never leak.
 * Next.js 16 changed route context params to Promise<unknown>; we await inside
 * the wrapper and pass a plain `params` object to the handler. */
export function handler(
  fn: (req: Request, ctx: { params: Record<string, string> }) => Promise<NextResponse>
) {
  return async (
    req: Request,
    ctx: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    try {
      const params = await ctx.params;
      return await fn(req, { params });
    } catch (e) {
      const logId = Date.now().toString(36).toUpperCase();
      console.error(`[route:${logId}]`, e);
      if (e instanceof Error && e.message.startsWith('HTTP_')) {
        const code = e.message;
        if (code === 'HTTP_400') return badRequest('Bad request');
        if (code === 'HTTP_401') return unauthorized();
        if (code === 'HTTP_403') return forbidden();
        if (code === 'HTTP_404') return notFound();
        if (code === 'HTTP_409') return conflict('Conflict');
      }
      return serverError(logId);
    }
  };
}