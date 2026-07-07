/**
 * Shared helpers for Hermez route handlers.
 * Centralises DB init + error envelope so each route stays tiny.
 */
import { initDbClients } from "@ykp/schema";
import { Role, requireRole } from "@ykp/auth";

initDbClients();

export type Json<T> = { data: T };
export type JsonError = { error: { code: string; message: string } };

export function ok<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ data } satisfies Json<T>), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: { code, message } } satisfies JsonError),
    { status, headers: { "content-type": "application/json" } },
  );
}

export async function requireOwnerOrSuperAdmin() {
  return requireRole([Role.OWNER, Role.SUPER_ADMIN]);
}

export async function requireSuperAdmin() {
  return requireRole([Role.SUPER_ADMIN]);
}

/** Parse a YYYY-MM-DD query param; returns null when absent/invalid. */
export function parseDateParam(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

/** Serialize a Date column to YYYY-MM-DD for stable client rendering. */
export function toDateString(d: Date | null | undefined): string | null {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Serialize a Date column to ISO-like string for client display. */
export function toIsoString(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

/**
 * Defect Z7 helper: map a thrown auth error from requireRole/requireAuth
 * to the correct HTTP status. Always returned as a Response so callers can
 * `return mapAuthError(err)` directly.
 */
export function mapAuthError(err: unknown): Response {
  const e = err as Error & { status?: number };
  const status = typeof e.status === "number" ? e.status : 401;
  const code = status === 403 ? "forbidden" : "unauth";
  const message = status === 403 ? "Forbidden: insufficient role" : "Unauthorized";
  return fail(code, message, status);
}