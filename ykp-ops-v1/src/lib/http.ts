/**
 * JSON response helpers. 5xx never leaks stack.
 */
import { NextResponse, type NextRequest } from 'next/server';

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

export function notFound(message = 'Not found'): NextResponse {
  return fail('not_found', message, 404);
}

export function serverError(logId?: string): NextResponse {
  return fail('internal_error', `Internal server error${logId ? ` (ref ${logId})` : ''}`, 500);
}

/**
 * Next.js 16 route-handler context.
 *
 * The second argument MUST be required and `params` MUST be a Promise —
 * Next 16 validates exported route handlers against `RouteContext` at build
 * time and rejects optional context
 * (`{ params?: Promise<...> } = {}`), even though `tsc --noEmit` passes.
 * Keep this type exact; the runtime body below stays tolerant instead.
 */
export type RouteContext = { params: Promise<Record<string, string>> };

/**
 * Wrap an async route handler; catch all errors, never leak.
 * Awaits the async `params` and passes a plain object to `fn`, so dynamic
 * segments (`[id]`) keep working and static routes resolve to `{}`.
 */
export function handler(
  fn: (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<NextResponse>
) {
  return async (req: NextRequest, ctx: RouteContext): Promise<NextResponse> => {
    try {
      // Runtime tolerance only (types stay required for the Next validator):
      // a directly-called static route may pass no context, and legacy
      // callers/tests may pass a sync params object. `await` passes sync
      // values through unchanged.
      const raw = (ctx as { params?: unknown } | undefined)?.params;
      const params = (raw ? await raw : {}) as Record<string, string>;
      return await fn(req, { params });
    } catch (e) {
      const logId = Date.now().toString(36).toUpperCase();
      console.error(`[route:${logId}]`, e);
      return serverError(logId);
    }
  };
}
