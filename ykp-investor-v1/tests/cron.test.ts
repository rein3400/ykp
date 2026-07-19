import { describe, it, expect, afterEach } from 'vitest';
import { safeEqual, providedCronSecret, isCronAuthorized } from '@/lib/cron';

const SECRET = 'test-cron-secret-32-chars-padded!!';

afterEach(() => {
  delete process.env.CRON_SECRET;
});

function reqWith(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/investor/notify/daily-brief', { method: 'POST', headers });
}

describe('safeEqual', () => {
  it('true for identical strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
  });
  it('false for different strings or lengths', () => {
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', 'a')).toBe(false);
  });
});

describe('providedCronSecret', () => {
  it('reads x-cron-secret header', () => {
    expect(providedCronSecret(reqWith({ 'x-cron-secret': 's3cret' }))).toBe('s3cret');
  });
  it('reads Authorization: Bearer', () => {
    expect(providedCronSecret(reqWith({ authorization: 'Bearer s3cret' }))).toBe('s3cret');
  });
  it('empty when no header', () => {
    expect(providedCronSecret(reqWith({}))).toBe('');
  });
});

describe('isCronAuthorized', () => {
  it('denies when CRON_SECRET is not configured', () => {
    expect(isCronAuthorized(reqWith({ 'x-cron-secret': 'anything' }))).toBe(false);
  });
  it('denies wrong or missing secret', () => {
    process.env.CRON_SECRET = SECRET;
    expect(isCronAuthorized(reqWith({ 'x-cron-secret': 'wrong' }))).toBe(false);
    expect(isCronAuthorized(reqWith({}))).toBe(false);
  });
  it('accepts the configured secret via header or bearer', () => {
    process.env.CRON_SECRET = SECRET;
    expect(isCronAuthorized(reqWith({ 'x-cron-secret': SECRET }))).toBe(true);
    expect(isCronAuthorized(reqWith({ authorization: `Bearer ${SECRET}` }))).toBe(true);
  });
});
