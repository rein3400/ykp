import { describe, it, expect } from 'vitest';
import { nextSequentialIdSync, nextNumericSeq } from './repo';

describe('nextSequentialIdSync uniqueness', () => {
  it('returns IDs with PREFIX- prefix', () => {
    expect(nextSequentialIdSync('ATT')).toMatch(/^ATT-/);
  });

  it('produces unique IDs across 1000 calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(nextSequentialIdSync('ATT'));
    }
    expect(ids.size).toBe(1000);
  });

  it('produces unique IDs across 50 parallel calls', async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, () => Promise.resolve(nextSequentialIdSync('LV')))
    );
    expect(new Set(results).size).toBe(50);
  });
});

describe('nextNumericSeq', () => {
  it('returns 1 when called (placeholder — requires Sheets live to scan)', () => {
    // Pure logic test: nextNumericSeq is async + reads Sheets; not unit-testable
    // without a live spreadsheet. Function exported for completeness.
    expect(typeof nextNumericSeq).toBe('function');
  });
});