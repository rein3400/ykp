/**
 * Small helper to produce consistent JSON error responses for the HR API.
 * Every route returns { data } or { error: { code, message } } with the
 * matching HTTP status.
 */

export type ErrorCode = 400 | 401 | 403 | 404 | 409 | 422 | 500;

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
  };
}

export function jsonError(code: ErrorCode, message: string): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, {
    status: code,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonOk<T>(data: T): Response {
  return Response.json({ data }, { headers: { "Content-Type": "application/json" } });
}

// Convenience aliases for handler/ok/fail used by other route files.
export function ok<T>(data: T, status = 200): Response {
  return jsonOk(data);
}

export function fail(code: ErrorCode, message: string): Response {
  return jsonError(code, message);
}

export type HandlerFn = (req: any, ctx?: any) => Promise<Response>;

export function handler(fn: HandlerFn): HandlerFn {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return handleError(err);
    }
  };
}

/** Convert a thrown value into a JSON response with best-effort code. */
export function handleError(err: unknown): Response {
  if (err instanceof Error && (err as Error & { status?: number }).status) {
    const status = (err as Error & { status?: number }).status ?? 500;
    if (status === 401) return jsonError(401, err.message);
    if (status === 403) return jsonError(403, err.message);
    if (status === 422) return jsonError(422, err.message);
    if (status === 409) return jsonError(409, err.message);
  }
  if (err instanceof Error) {
    // Defect S5: never leak raw err.message on 5xx. Log server-side, return generic.
    if (process.env.NODE_ENV !== "production") {
      console.error("[hr] handleError:", err.message);
    }
    return jsonError(500, "Internal server error");
  }
  return jsonError(500, "Unknown server error");
}