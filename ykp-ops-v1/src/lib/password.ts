import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

export interface VerifyResult {
  ok: boolean;
  needsRehash: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function isLegacySha256(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

export async function verifyPassword(password: string, hash: string): Promise<VerifyResult> {
  if (isLegacySha256(hash)) {
    const sha = createHash('sha256').update(password).digest('hex');
    return { ok: sha.toLowerCase() === hash.toLowerCase(), needsRehash: true };
  }
  return { ok: bcrypt.compareSync(password, hash), needsRehash: false };
}
