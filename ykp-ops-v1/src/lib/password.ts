import bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'node:crypto';

/** bcrypt hashes start with $2a$ / $2b$ / $2y$. */
export function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$/.test(hash);
}

export function legacySha256(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

/**
 * Verify a password against a stored hash. Supports bcrypt (HR accounts copied
 * into Ops keep working with their existing password) and legacy sha256.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const hash = (stored ?? '').trim();
  if (!hash || !plain) return false;
  if (isBcryptHash(hash)) return bcrypt.compare(plain, hash);
  const candidate = legacySha256(plain);
  const a = Buffer.from(candidate);
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}
