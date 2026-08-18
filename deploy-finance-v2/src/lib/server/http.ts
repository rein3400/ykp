/**
 * Route-handler response helpers. Always return JSON with the contract
 * shape {data} | {error:{code,message}} and the correct Content-Type +
 * status. Keeping these in one place avoids each route reinventing the
 * envelope and drifting from the binding contract.
 */

export type ApiErrorCode =
  | "bad_request"
  | "validation_error"
  | "missing_ref"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "approval_required"
  | "internal_error";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  validation_error: 400,
  missing_ref: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  approval_required: 422,
  internal_error: 500,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function ok<T>(data: T, status = 200): Response {
  return json({ data }, status);
}

export function fail(code: ApiErrorCode, message: string, details?: unknown): Response {
  const error: ApiError = { code, message, ...(details !== undefined ? { details } : undefined) };
  return json({ error }, STATUS_BY_CODE[code]);
}

/**
 * Wrap an async route body so any thrown Error becomes a typed API error.
 * Errors carrying a numeric `status` property (from requireRole / can
 * guards) keep that status; everything else maps to internal_error 500.
 */
export function handler(fn: (req: any, ctx?: any) => Promise<Response>): (req: any, ctx?: any) => Promise<Response> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: any, ctx?: any) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      const e = err as Error & { status?: number; name?: string; code?: string };
      // Defect I2 fix: MissingRefError (or err.code === "missing_ref") must
      // return 400, not 500. assert* helpers in refs.js throw this on unknown
      // cross-DB FK targets.
      if ((e.name === "MissingRefError" || e.code === "missing_ref") && !e.status) {
        return fail("missing_ref", e.message ?? "Missing reference");
      }
      if (typeof e.status === "number") {
        const code: ApiErrorCode =
          e.status === 401 ? "unauthorized" : e.status === 403 ? "forbidden" : e.status === 404 ? "not_found" : "bad_request";
        return fail(code, e.message);
      }
      // Defect S5 fix: never leak err.message on 5xx; log server-side.
      if (process.env.NODE_ENV !== "production") {
        console.error("[finance handler]", e);
      }
      return fail("internal_error", "Internal server error");
    }
  };
}