/**
 * CRON_SECRET guard for scheduler-called endpoints (e.g. daily-brief notify).
 * Accepts the secret via `x-cron-secret` header or `Authorization: Bearer <secret>`.
 * Constant-time comparison; unauthorized when CRON_SECRET is not configured.
 */
import { timingSafeEqual } from 'crypto';

/** Constant-time string compare (length-checked first). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Extract the presented cron secret from request headers. */
export function providedCronSecret(req: Request): string {
  const h = req.headers.get('x-cron-secret');
  if (h) return h.trim();
  const auth = req.headers.get('authorization') ?? '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? '';
}

/** True only when CRON_SECRET is configured AND the request presents a matching secret. */
export function isCronAuthorized(req: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? '').trim();
  if (!secret) return false;
  const provided = providedCronSecret(req);
  if (!provided) return false;
  return safeEqual(provided, secret);
}
