/**
 * Simple in-memory rate limiter. Per (userId OR ip, key). Not distributed.
 * For the Sheets V1 pilot this is sufficient; for multi-replica production
 * deployments, replace the Map with a Redis backend (e.g. Upstash Ratelimit)
 * so the bucket is shared across server instances. The function signature
 * (key, limit, windowMs) remains the same, so callers do not need to change.
 *
 * Suggested production adapter:
 *   import { Ratelimit } from "@upstash/ratelimit";
 *   import { Redis } from "@upstash/redis";
 *   const ratelimit = new Ratelimit({
 *     redis: Redis.fromEnv(),
 *     limiter: Ratelimit.slidingWindow(60, "30s"),
 *   });
 *   const { success } = await ratelimit.limit(key);
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export interface LimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  b.count += 1;
  if (b.count > limit) return { ok: false, remaining: 0, resetAt: b.resetAt };
  return { ok: true, remaining: limit - b.count, resetAt: b.resetAt };
}

export function clientKey(req: Request, userId?: string): string {
  if (userId) return `u:${userId}`;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  return `ip:${ip}`;
}
