import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { randomBytes } from 'crypto';
import { readTab } from '@/db/sheets';
import { nextSequentialIdSync, nextNumericSeq } from './repo';

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return { ...actual, randomBytes: vi.fn((size: number) => actual.randomBytes(size)) };
});
vi.mock('@/db/sheets', () => ({
  TABS: { attendance: 'fact_attendance' },
  readTab: vi.fn(async () => []), findRow: vi.fn(), appendRows: vi.fn(), updateRow: vi.fn()
}));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(readTab).mockResolvedValue([]); });
afterEach(() => vi.restoreAllMocks());

describe('nextSequentialIdSync collision resistance', () => {
  it('returns IDs with PREFIX- prefix', () => {
    expect(nextSequentialIdSync('ATT')).toMatch(/^ATT-/);
  });
  it('uses 128 bits of cryptographic randomness even at a frozen timestamp', () => {
    const now = 1788710400000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const id = nextSequentialIdSync('ATT');
    expect(randomBytes).toHaveBeenCalledWith(16);
    const suffix = id.slice(('ATT-' + now.toString(36).toUpperCase()).length);
    expect(suffix).toMatch(/^[0-9A-F]{32}$/);
  });
  it('produces distinct IDs across 1000 calls in the same millisecond', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1788710400000);
    const ids = new Set(Array.from({ length: 1000 }, () => nextSequentialIdSync('ATT')));
    expect(ids.size).toBe(1000);
  });
  it('produces distinct IDs across 50 parallel calls', async () => {
    const results = await Promise.all(Array.from({ length: 50 }, () => Promise.resolve(nextSequentialIdSync('LV'))));
    expect(new Set(results).size).toBe(50);
  });
});
describe('nextNumericSeq', () => {
  it('starts at one on an empty table', async () => {
    expect(await nextNumericSeq('attendance', 'attendance_id', 'ATT')).toBe(1);
    expect(readTab).toHaveBeenCalledWith('fact_attendance');
  });
  it('increments the largest matching numeric id without changing sequential-id behavior', async () => {
    vi.mocked(readTab).mockResolvedValue([{ attendance_id: 'ATT-004' }, { attendance_id: 'ATT-012' }, { attendance_id: 'LV-900' }, { attendance_id: 'ATT-TEXT' }]);
    expect(await nextNumericSeq('attendance', 'attendance_id', 'ATT')).toBe(13);
  });
});
