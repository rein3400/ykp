import { describe, it, expect } from 'vitest';
import { evaluateHardGates } from '../src/modules/hard-gates.js';

const base = {
  sweep: 'ssl',
  mss: 'bull',
  ifvg: 'bull',
  bias: 'bull',
  sessionOk: true,
  newsOk: true,
  rr: 3
};

describe('evaluateHardGates', () => {
  it('passes a complete bullish setup', () => {
    const r = evaluateHardGates(base);
    expect(r.ok).toBe(true);
    expect(r.failed).toEqual([]);
  });

  it('rejects missing sweep', () => {
    const r = evaluateHardGates({ ...base, sweep: '' });
    expect(r.ok).toBe(false);
    expect(r.failed).toContain('NO_SWEEP');
  });

  it('rejects missing MSS', () => {
    const r = evaluateHardGates({ ...base, mss: '' });
    expect(r.ok).toBe(false);
    expect(r.failed).toContain('NO_MSS');
  });

  it('rejects missing IFVG', () => {
    const r = evaluateHardGates({ ...base, ifvg: '' });
    expect(r.ok).toBe(false);
    expect(r.failed).toContain('NO_IFVG');
  });

  it('rejects news window', () => {
    const r = evaluateHardGates({ ...base, newsOk: false });
    expect(r.ok).toBe(false);
    expect(r.failed).toContain('NEWS');
  });

  it('rejects out of session', () => {
    const r = evaluateHardGates({ ...base, sessionOk: false });
    expect(r.ok).toBe(false);
    expect(r.failed).toContain('SESSION');
  });

  it('rejects RR < 3', () => {
    const r = evaluateHardGates({ ...base, rr: 2.5 });
    expect(r.ok).toBe(false);
    expect(r.failed).toContain('RR');
  });

  it('rejects misaligned bias/mss/ifvg', () => {
    const r = evaluateHardGates({ ...base, ifvg: 'bear' });
    expect(r.ok).toBe(false);
    expect(r.failed).toContain('ALIGNMENT');
  });

  it('rejects SSL with bearish bias', () => {
    const r = evaluateHardGates({
      ...base,
      bias: 'bear',
      mss: 'bear',
      ifvg: 'bear',
      sweep: 'ssl'
    });
    expect(r.ok).toBe(false);
    expect(r.failed).toContain('SWEEP_SIDE');
  });

  it('accepts BSL with bearish bias', () => {
    const r = evaluateHardGates({
      ...base,
      bias: 'bear',
      mss: 'bear',
      ifvg: 'bear',
      sweep: 'bsl'
    });
    expect(r.ok).toBe(true);
  });
});
