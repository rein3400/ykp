/**
 * Password hashing. All new hashes are bcrypt (bcryptjs, pure JS).
 * Legacy unsalted sha256 hex hashes (64-char) still verify, but the caller
 * must transparently re-hash to bcrypt on successful login (migration path).
 */
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const BCRYPT_ROUNDS = 10;

/** Legacy format: unsalted sha256 hex digest. */
export function isLegacySha256(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/** bcrypt hashes start with $2a$ / $2b$ / $2y$. */
export function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash);
}

export function sha256Hex(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

/** Hash a new/changed password. Always bcrypt. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export interface VerifyResult {
  ok: boolean;
  /** true when the password matched a legacy sha256 hash and must be re-hashed to bcrypt. */
  needsRehash: boolean;
}

/**
 * Verify a password against a stored hash (bcrypt or legacy sha256).
 * Returns needsRehash=true only when a legacy sha256 hash matched.
 */
export async function verifyPassword(plain: string, stored: string): Promise<VerifyResult> {
  if (!stored) return { ok: false, needsRehash: false };
  if (isBcryptHash(stored)) {
    const ok = await bcrypt.compare(plain, stored).catch(() => false);
    return { ok, needsRehash: false };
  }
  if (isLegacySha256(stored)) {
    const ok = sha256Hex(plain) === stored.toLowerCase();
    return { ok, needsRehash: ok };
  }
  return { ok: false, needsRehash: false };
}
