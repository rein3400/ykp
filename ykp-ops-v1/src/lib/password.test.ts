import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { verifyPassword } from './password';

describe('ops password verification', () => {
  it('accepts bcrypt hashes copied from the HR module without resetting passwords', async () => {
    const hash = await bcrypt.hash('rahasia-uji', 10);
    expect(await verifyPassword('rahasia-uji', hash)).toBe(true);
    expect(await verifyPassword('salah', hash)).toBe(false);
  });
  it('still accepts legacy sha256 hashes', async () => {
    const hash = createHash('sha256').update('legacy-uji').digest('hex');
    expect(await verifyPassword('legacy-uji', hash)).toBe(true);
    expect(await verifyPassword('salah', hash)).toBe(false);
  });
  it('rejects empty stored hashes', async () => {
    expect(await verifyPassword('apa pun', '')).toBe(false);
  });
});
