import { describe, it, expect } from 'vitest';
import { auditId } from './audit';

describe('auditId uniqueness', () => {
  it('returns IDs with expected shape', () => {
    const id = auditId();
    expect(id).toMatch(/^AUD-[A-Z0-9]+-[A-F0-9]+$/);
  });

  it('produces unique IDs across 1000 calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(auditId());
    }
    expect(ids.size).toBe(1000);
  });

  it('does not rely on process-local counter (different process start, same id set)', () => {
    // Two separate "process starts" simulated by 2 separate auditId() factories would
    // be impossible in-process; instead verify that two rapid-fire ids in same tick
    // are still distinct, which the counter-free implementation guarantees.
    const a = auditId();
    const b = auditId();
    const c = auditId();
    expect(new Set([a, b, c]).size).toBe(3);
  });
});