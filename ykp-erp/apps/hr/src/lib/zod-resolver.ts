import { z, type ZodSchema, type ZodError } from "zod";
import { jsonError } from "./api-error.js";

/**
 * Parse a request body with a zod schema. Returns a typed value on success
 * or a Response with HTTP 400 on failure.
 */
export async function resolveBody<T>(req: Request, schema: ZodSchema<T>): Promise<T | Response> {
  try {
    const raw = await req.json();
    return schema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, formatZodError(err));
    }
    return jsonError(400, "Invalid JSON body");
  }
}

function formatZodError(err: ZodError): string {
  return err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

/**
 * Parse query parameters with a zod schema. Strings are left as strings;
 * numbers/coerced dates are handled by the caller schema.
 */
export function resolveQuery<T>(url: URL, schema: ZodSchema<T>): T | Response {
  const raw: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams.entries()) {
    raw[key] = value;
  }
  try {
    return schema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, formatZodError(err));
    }
    return jsonError(400, "Invalid query parameters");
  }
}