import { describe, it, expect } from 'vitest';
import {
  isLegacySha256, isBcryptHash, sha256Hex,
  hashPassword, verifyPassword
} from '@/lib/password';

describe('hash format detection', () => {
  it('detects legacy sha256 hex', () => {
    expect(isLegacySha256(sha256Hex('owner123'))).toBe(true);
    expect(isLegacySha256('abc')).toBe(false);
    expect(isLegacySha256('')).toBe(false);
  });
  it('detects bcrypt hashes', async () => {
    const h = await hashPassword('secret');
    expect(isBcryptHash(h)).toBe(true);
    expect(isLegacySha256(h)).toBe(false);
  });
});

describe('bcrypt verify', () => {
  it('round-trips a bcrypt hash', async () => {
    const h = await hashPassword('owner123');
    const v = await verifyPassword('owner123', h);
    expect(v.ok).toBe(true);
    expect(v.needsRehash).toBe(false);
  });
  it('rejects wrong password against bcrypt', async () => {
    const h = await hashPassword('owner123');
    const v = await verifyPassword('wrong', h);
    expect(v.ok).toBe(false);
    expect(v.needsRehash).toBe(false);
  });
});

describe('legacy sha256 migration path', () => {
  it('verifies legacy sha256 and flags rehash', async () => {
    const v = await verifyPassword('owner123', sha256Hex('owner123'));
    expect(v.ok).toBe(true);
    expect(v.needsRehash).toBe(true);
  });
  it('accepts uppercase legacy hex', async () => {
    const v = await verifyPassword('owner123', sha256Hex('owner123').toUpperCase());
    expect(v.ok).toBe(true);
    expect(v.needsRehash).toBe(true);
  });
  it('rejects wrong password against legacy hash without rehash', async () => {
    const v = await verifyPassword('nope', sha256Hex('owner123'));
    expect(v.ok).toBe(false);
    expect(v.needsRehash).toBe(false);
  });
  it('migrated hash verifies as bcrypt afterwards', async () => {
    const v1 = await verifyPassword('owner123', sha256Hex('owner123'));
    expect(v1.needsRehash).toBe(true);
    const rehashed = await hashPassword('owner123');
    expect(await verifyPassword('owner123', rehashed)).toEqual({ ok: true, needsRehash: false });
  });
});

describe('unknown/empty stored hash', () => {
  it('fails closed', async () => {
    expect(await verifyPassword('x', '')).toEqual({ ok: false, needsRehash: false });
    expect(await verifyPassword('x', 'not-a-hash')).toEqual({ ok: false, needsRehash: false });
  });
});
