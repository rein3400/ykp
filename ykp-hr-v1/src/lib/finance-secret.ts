/**
 * Shared cross-app secret for Finance ↔ HR calls (MOM 1 Sep 2026).
 *
 * Finance NEVER writes HR tabs directly (cross-domain read-only invariant);
 * it calls HR-side routes that validate this secret via `x-finance-secret`.
 * Accepts FINANCE_NOTIFY_SECRET or HR_NOTIFY_SECRET (either env name).
 */
import { safeEqual } from './cron';

/** Configured shared secret, or '' when not set (all secret calls fail). */
export function financeSecret(): string {
  return (process.env.FINANCE_NOTIFY_SECRET ?? process.env.HR_NOTIFY_SECRET ?? '').trim();
}

/** True when the request carries a valid `x-finance-secret` header. */
export function financeSecretValid(req: Request): boolean {
  const secret = financeSecret();
  if (!secret) return false;
  const presented = (req.headers.get('x-finance-secret') ?? '').trim();
  if (!presented) return false;
  return safeEqual(presented, secret);
}
